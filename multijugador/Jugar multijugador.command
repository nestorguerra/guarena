#!/bin/bash
# Doble clic: abre el servidor multijugador de Guareña y el juego en tu navegador.
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 servidor.py
else
  echo "Para el multijugador hace falta Python 3: https://www.python.org/downloads/"
  read -n 1 -s -r -p "Pulsa una tecla para cerrar…"
fi
