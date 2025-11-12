@echo off
title Building MSP RAPID View Executable...
color 0A

echo.
echo ==============================================
echo     🚀 Building MSP RAPID View Executable
echo ==============================================
echo.

:: Detect Python
echo Detecting Python environment...
for /f "delims=" %%i in ('where python 2^>nul') do set PYTHON_EXE=%%i
if not defined PYTHON_EXE (
    echo ❌ Python not found. Please install Python and ensure it is added to PATH.
    pause
    exit /b
)
echo ✅ Using Python: %PYTHON_EXE%
echo.

:: Check if PyInstaller is installed
echo Checking PyInstaller module...
"%PYTHON_EXE%" -m pyinstaller --version >nul 2>&1
if errorlevel 1 (
    echo ⚙️ Installing PyInstaller...
    "%PYTHON_EXE%" -m pip install --upgrade pip >nul
    "%PYTHON_EXE%" -m pip install pyinstaller >nul
)

:: Define build parameters
set EXE_NAME=MSP_RAPID_View
set ICON_FILE=rapidview.ico

echo.
echo 🏗️ Starting build process...
echo ----------------------------------------------

:: Build EXE
"%PYTHON_EXE%" -m pyinstaller --noconfirm --onefile ^
 --name "%EXE_NAME%" ^
 --add-data "templates;templates" ^
 --add-data "static;static" ^
 --icon "%ICON_FILE%" ^
 app.py

echo.
if exist "dist\%EXE_NAME%.exe" (
    echo ✅ Build completed successfully!
    echo ----------------------------------------------
    echo 📦 Executable: dist\%EXE_NAME%.exe
    echo 📁 Opening output folder...
    start "" "dist"
) else (
    echo ❌ Build failed! Please check the error messages above.
)

echo.
echo ==============================================
echo        Build process finished.
echo ==============================================
pause
