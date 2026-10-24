@echo off
chcp 65001 >nul
rem Двойной клик собирает приложение MiniFig для Windows. Нужен установленный Node.js (один раз).
cd /d "%~dp0"
echo ===================================================
echo    Сборка MiniFig для Windows
echo ===================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Не найден Node.js — он нужен для сборки (ставится один раз^).
  echo     Сейчас откроется сайт. Скачайте кнопку LTS, установите,
  echo     затем снова запустите этот файл.
  start "" "https://nodejs.org/en/download"
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do echo [OK] Node.js: %%v
echo.
echo -^> Устанавливаю зависимости (первый раз ~1-3 минуты)...
call npm install
if errorlevel 1 ( echo. & echo [!] Не удалось установить зависимости. Проверьте интернет. & pause & exit /b 1 )

echo.
echo -^> Собираю приложение...
call npm run dist:win
if errorlevel 1 ( echo. & echo [!] Ошибка сборки. Пришлите лог выше. & pause & exit /b 1 )

echo.
echo ===================================================
echo    Готово!
echo ===================================================
echo В папке dist лежит установщик MiniFig Setup ....exe — запустите его.
start "" "dist"
echo.
pause
