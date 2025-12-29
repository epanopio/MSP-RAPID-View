@echo off
title Building MSP RAPID View EXE...
color 0A

echo Cleaning old builds...
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul
del MSP_RAPID_View.spec 2>nul

echo Building new EXE...

pyinstaller --noconfirm --onefile ^
 --name "MSP_RAPID_View" ^
 --hidden-import flask ^
 --add-data "templates;templates" ^
 --add-data "static;static" ^
 --icon=app_icon.ico ^
 app.py

echo Build complete!
pause
