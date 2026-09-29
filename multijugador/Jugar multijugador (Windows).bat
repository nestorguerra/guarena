@echo off
rem Doble clic: abre el servidor multijugador de Guarena y el juego en tu navegador.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 servidor.py & goto :eof)
where python >nul 2>nul && (python servidor.py & goto :eof)
echo Para el multijugador hace falta Python 3: https://www.python.org/downloads/
pause
