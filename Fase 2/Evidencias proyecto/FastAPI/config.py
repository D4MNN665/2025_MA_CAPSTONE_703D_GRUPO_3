from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

tags_metadata = [
    {
        "name": "CRUD vecinos",
        "description": "es solo un crud de vecinos para el admin: ",
    },
    {
        "name": "CRUD Noticias",
        "description": "es solo un crud de noticias para el admin: ",
    },
    {
        "name": "CRUD Proyectos",
        "description": "es solo un crud de proyectos para el admin: ",
    },
    {
        "name": "CRUD Reservas",
        "description": "es solo un crud de reservas para el admin: ",
    },
    {
        "name": "Autenticación",
        "description": "Manejo de autenticación y generación de tokens JWT",
    },
    {
        "name": "Actividades",
        "description": "Gestión de actividades para vecinos",
    }
]


app = FastAPI(openapi_tags=tags_metadata)
app.version = "1.0.0"


def configurar_cors(app):
    # En desarrollo permitimos los orígenes locales concretos.
    # Evitar "*" cuando allow_credentials=True para no provocar ausencia del header.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )