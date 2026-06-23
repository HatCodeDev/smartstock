#include <Arduino.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include "config.h"
#include "rfid/rfid_reader.h"
#include "network/wifi_manager.h"
#include "network/mqtt_client.h"
#include "network/offline_buffer.h"
#include "batch/batch_builder.h"
#include "buzzer/buzzer.h"
#include "button/button.h"
#include "led/led_status.h"

// Definiciones para el Watchdog
#define WDT_TIMEOUT 10 // 10 segundos

RFIDReader rfid;
WiFiManagerHelper wifi;
MQTTClientManager mqtt;
OfflineBuffer offlineBuffer(OFFLINE_MAX_BATCH);
BatchBuilder batch;
BuzzerManager buzzer;
ButtonManager button;
LedManager led;

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000);

unsigned long lastOfflineRetry = 0;

// Helper para logs con timestamp
void logMsg(String tag, String msg) {
    Serial.printf("[%lu] [%s] %s\n", millis(), tag.c_str(), msg.c_str());
}

void onModeChanged(String newMode) {
    logMsg("MODO", "Cambio a: " + newMode);
    
    if (newMode == "SALIDA") buzzer.play(BUZZ_MODE_SALIDA);
    else if (newMode == "RETORNO") buzzer.play(BUZZ_MODE_RETORNO);
    else if (newMode == "REGISTRO") buzzer.play(BUZZ_MODE_REGISTRO);
    else if (newMode == "APAGADO") buzzer.play(BUZZ_MODE_APAGADO);
    
    if (mqtt.isConnected()) {
        JsonDocument doc;
        doc["command"] = "SET_MODE";
        doc["mode"] = newMode;
        doc["status"] = "ok";
        String payload;
        serializeJson(doc, payload);
        
        String ackTopic = "smartstock/" + String(DEVICE_ID) + "/ack";
        mqtt.publish(ackTopic.c_str(), payload.c_str());
    }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    String message;
    for (int i = 0; i < (int)length; i++) {
        message += (char)payload[i];
    }
    
    logMsg("MQTT", "Mensaje recibido en: " + String(topic));
    
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
        String command = doc["command"];
        if (command == "SET_MODE") {
            String newMode = doc["mode"];
            logMsg("MQTT", "Comando SET_MODE: " + newMode);
            button.setMode(newMode);
            if (newMode == "APAGADO") {
                button.lock();
            } else {
                button.unlock();
            }
        } else if (command == "BUZZER_BATCH") {
            // El backend confirmó el resultado del lote — reproducir UN sonido consolidado.
            String buzzerStr = doc["data"]["buzzer"].as<String>();
            logMsg("BUZZ", "BUZZER_BATCH recibido: " + buzzerStr);

            if (buzzerStr == "ERROR") {
                buzzer.play(BUZZ_UNKNOWN_TAG);
            } else if (buzzerStr == "SALIDA_OK") {
                buzzer.play(BUZZ_OK_SALIDA);
            } else if (buzzerStr == "RETORNO_OK") {
                buzzer.play(BUZZ_OK_RETORNO);
            } else if (buzzerStr == "REGISTRO_NUEVA") {
                buzzer.play(BUZZ_REG_NEW);
            } else if (buzzerStr == "BUZZ_CYCLE_CLOSED") {
                buzzer.play(BUZZ_CYCLE_CLOSED);
                button.setMode("APAGADO");
                button.lock();
            }
            // "NONE" o desconocido → silencio (duplicados, sin movimiento real)
        }
    }
}

void onTagRead(String epc) {
    logMsg("RFID", "EPC capturado: " + epc);

    // Micro-tick por cada EPC nuevo: efecto Geiger, no satura.
    // playIfLow descarta si el buzzer ya reproduce (anti-saturación).
    if (button.getCurrentMode() != "APAGADO") {
        buzzer.playIfLow(BUZZ_TICK);
    }

    batch.addTag(epc);
}

void setup() {
    Serial.begin(115200);
    delay(1000); // Darle tiempo al serial
    Serial.println("\n--- SmartStock Portal Inicializando ---");
    
    led.begin();
    buzzer.begin();
    buzzer.playBlocking(BUZZ_MODE_APAGADO); // Pitido de inicio bloqueante
    
    button.begin();
    button.onChangeMode(onModeChanged);
    
    // 1. Intentar conectar a WiFi (Bloqueante si no hay credenciales guardadas)
    // El portal cautivo puede tardar minutos. El Watchdog aún no está activo.
    wifi.begin();
    
    // 2. Configurar Watchdog ahora que el WiFi se ha establecido con éxito
    logMsg("SISTEMA", "Configurando Watchdog (10s)...");
    esp_task_wdt_init(WDT_TIMEOUT, true); // enable panic so it reboots
    esp_task_wdt_add(NULL); // add current thread (loop)
    
    mqtt.begin();
    mqtt.getClient().setCallback(onMqttMessage);
    
    timeClient.begin();
    rfid.begin(onTagRead);
    
    logMsg("SISTEMA", "Portal listo. Modo actual: " + button.getCurrentMode());
}

void loop() {
    // Alimentar al perro (Reset WDT)
    esp_task_wdt_reset();

    wifi.tick();
    mqtt.tick();
    buzzer.tick();
    button.tick();
    led.tick();

    // Control de desbloqueo automático diario (cuando cambia la fecha)
    if (wifi.isConnected() && timeClient.getEpochTime() > 1000000) {
        time_t epochTime = timeClient.getEpochTime();
        struct tm *ptm = gmtime((const time_t *)&epochTime);
        int currentDay = ptm->tm_yday;
        int currentYear = ptm->tm_year;
        
        static int lastCheckedDay = -1;
        static int lastCheckedYear = -1;
        
        if (lastCheckedDay == -1) {
            lastCheckedDay = currentDay;
            lastCheckedYear = currentYear;
        }
        
        if (currentDay != lastCheckedDay || currentYear != lastCheckedYear) {
            // Cambio de día: desbloquear botón automáticamente para permitir iniciar turno
            button.unlock();
            lastCheckedDay = currentDay;
            lastCheckedYear = currentYear;
        }
    }
    
    if (!wifi.isConnected()) {
        led.setState(LED_BLINK_SLOW);
    } else if (!mqtt.isConnected()) {
        led.setState(LED_BLINK_FAST);
    } else {
        led.setState(LED_SOLID_ON);
    }
    
    if (wifi.isConnected()) {
        timeClient.update();
    }
    
    // Solo poll si NO estamos en modo APAGADO
    if (button.getCurrentMode() != "APAGADO") {
        rfid.poll();
    }
    
    if (mqtt.isConnected() && !offlineBuffer.isEmpty()) {
        if (millis() - lastOfflineRetry >= OFFLINE_RETRY_MS) {
            lastOfflineRetry = millis();
            logMsg("BUFFER", "Reintentando envío pendiente (" + String(offlineBuffer.size()) + " en cola)");
            
            String pendingPayload = offlineBuffer.peek();
            String topic = "smartstock/" + String(DEVICE_ID) + "/events";
            
            if (mqtt.publish(topic.c_str(), pendingPayload.c_str())) {
                logMsg("BUFFER", "Envío OK. Eliminando del buffer.");
                offlineBuffer.pop();
            } else {
                logMsg("BUFFER", "Fallo en reintento.");
            }
        }
    }
    
    if (batch.isWindowReady()) {
        String currentMode = button.getCurrentMode();
        String payload = batch.buildPayload(DEVICE_ID, currentMode, timeClient.getEpochTime());
        String topic = "smartstock/" + String(DEVICE_ID) + "/events";
        
        logMsg("BATCH", "Ventana cerrada. Intentando enviar JSON...");
        if (mqtt.publish(topic.c_str(), payload.c_str())) {
            logMsg("MQTT", "Publicado en HiveMQ OK!");
            // El sonido de confirmación llega vía BUZZER_BATCH desde el backend.
        } else {
            logMsg("ERROR", "Fallo de conexión. Guardando en buffer offline.");
            offlineBuffer.push(payload);
            buzzer.play(BUZZ_NO_NETWORK);
        }
        
        batch.resetWindow();
    }
}
