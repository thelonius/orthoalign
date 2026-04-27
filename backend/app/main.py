import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import cases, suggest

app = FastAPI(title="OrthoAlign API", version="0.1.0")

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "orthoalign-api", "version": "0.1.0"}


app.include_router(cases.router, prefix="/api/cases", tags=["cases"])
app.include_router(suggest.router, prefix="/api/suggest", tags=["suggest"])
