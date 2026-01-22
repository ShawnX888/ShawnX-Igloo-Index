"""
Igloo Backend API - Main Application Entry Point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import claims, data_products, policies, products, risk_events
from app.db import dispose_engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await dispose_engine()

app = FastAPI(
    title="Igloo Index Insurance API",
    version="2.0.0",
    description="Backend API for Igloo Index Insurance Platform",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(products.router, prefix="/api/v1")
app.include_router(data_products.router, prefix="/api/v1")
app.include_router(claims.router, prefix="/api/v1")
app.include_router(claims.policy_router, prefix="/api/v1")
app.include_router(claims.stats_router, prefix="/api/v1")
app.include_router(policies.router, prefix="/api/v1")
app.include_router(policies.stats_router, prefix="/api/v1")
app.include_router(risk_events.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Igloo Index Insurance API",
        "version": "2.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
