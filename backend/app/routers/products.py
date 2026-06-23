from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.dependencies import get_db, get_current_user
from app.models.producto import Producto
from app.models.etiqueta import Etiqueta
from app.schemas.producto import ProductoCreate, ProductoResponse
from app.schemas.etiqueta import EtiquetaResponse

router = APIRouter(
    prefix="/api/products", tags=["products"], dependencies=[Depends(get_current_user)]
)


@router.post("", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
async def create_product(product: ProductoCreate, db: AsyncSession = Depends(get_db)):
    # RN-14: No se asignan etiquetas al crear el producto
    new_product = Producto(**product.model_dump())
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    return new_product


@router.get("", response_model=List[ProductoResponse])
async def list_products(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Producto).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/critical", response_model=List[ProductoResponse])
async def list_critical_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Producto).where(
            Producto.cantidad_inicial < Producto.stock_minimo,
            Producto.activo == True
        )
    )
    return result.scalars().all()


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(id: UUID, db: AsyncSession = Depends(get_db)):
    # Buscar producto
    result = await db.execute(select(Producto).where(Producto.id == id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Lógica de integridad (Baja Lógica):
    # Desactivar el producto y buscar sus etiquetas asociadas para marcarlas como inactivas
    product.activo = False

    etiquetas_result = await db.execute(
        select(Etiqueta).where(Etiqueta.producto_id == id)
    )
    etiquetas = etiquetas_result.scalars().all()
    for eq in etiquetas:
        eq.activa = False

    await db.commit()
    return None


@router.get("/{id}/tags", response_model=List[EtiquetaResponse])
async def list_product_tags(id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Retorna la lista de etiquetas RFID activas vinculadas a un producto.
    """
    result = await db.execute(
        select(Etiqueta).where(Etiqueta.producto_id == id, Etiqueta.activa == True)
    )
    return result.scalars().all()

