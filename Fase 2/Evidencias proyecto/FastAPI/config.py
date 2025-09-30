from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

tags_metadata = [
    {
        "name": "CRUD vecinos",
        "description": "es solo un crud de empleado para el admin :' ",
    },
    {
        "name": "CRUD Noticias",
        "description": "es solo un crud de empleado para el admin :' ",
    },
    {
        "name": "CRUD Proyectos",
        "description": "es solo un crud de empleado para el admin :' ",
    },

]


app = FastAPI(openapi_tags=tags_metadata)
app.version = "1.0.0"

def configurar_cors(app):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # * O especificar IP ["http://localhost:3000"]
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
