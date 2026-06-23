import serial
import time

# Configuración del puerto serie
PORT = 'COM8'
BAUDRATE = 38400
TIMEOUT = 0.1   # 100ms para no bloquear el loop
POLL_INTERVAL = 0.5  # 500ms entre cada comando de lectura

def send_inventory_command(ser):
    """
    Envía el comando de lectura 'Q' al lector FM-505.
    Protocolo confirmado por fabricante: enviar 'Q' + \r\n
    Si detecta etiqueta: responde Q + EPC (ej: Q3000E28069150000401CFAE6...)
    Si no hay etiqueta: responde solo 'Q'
    """
    ser.write(b'Q\r\n')

def parse_frame(line: str) -> tuple[str | None, str | None]:
    """
    Parsea una línea de respuesta del FM-505.
    Retorna (epc, varianza) si es una lectura válida, (None, None) si no hay tag.
    """
    # Respuesta sin tag: solo 'Q'
    if line == 'Q':
        return None, None

    # Respuesta con tag: Q + 24 chars EPC + 8 chars varianza
    if line.startswith('Q') and len(line) >= 25:
        epc = line[1:25]
        varianza = line[25:]
        return epc, varianza

    return None, None

def main():
    print(f"[*] FM-505 Validation Script — {PORT} @ {BAUDRATE} bps")
    print(f"[*] Modo Polling: comando 'Q' cada {int(POLL_INTERVAL * 1000)}ms")
    print("[*] Presioná Ctrl+C para salir.\n")

    reads = 0
    no_tag_count = 0

    try:
        ser = serial.Serial(PORT, BAUDRATE, timeout=TIMEOUT)
        last_poll = 0.0  # forzar envío inmediato al arrancar

        while True:
            now = time.time()

            # --- Enviar comando de polling ---
            if now - last_poll >= POLL_INTERVAL:
                send_inventory_command(ser)
                last_poll = now

            # --- Leer respuesta ---
            if ser.in_waiting > 0:
                raw = ser.readline()
                line = raw.decode('ascii', errors='ignore').strip()

                if not line:
                    continue

                epc, varianza = parse_frame(line)

                if epc:
                    reads += 1
                    print(f"[+] #{reads:>3} EPC: {epc}  Varianza: {varianza}")
                elif line == 'Q':
                    no_tag_count += 1
                    # Descommentá la línea de abajo para ver las respuestas vacías
                    # print(f"[-] Sin etiqueta (acumuladas: {no_tag_count})")
                else:
                    print(f"[?] Trama inesperada: '{line}' | hex: {raw.hex()}")

            time.sleep(0.01)

    except serial.SerialException as e:
        print(f"\n[X] Error de puerto {PORT}: {e}")
        print("    -> Verificá que ningún otro programa (hTerm, Realterm) esté usando el puerto.")
    except KeyboardInterrupt:
        print(f"\n[*] Detenido. Lecturas exitosas: {reads} | Sin etiqueta: {no_tag_count}")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()
            print("[*] Puerto cerrado correctamente.")

if __name__ == "__main__":
    main()
