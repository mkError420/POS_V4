@echo off
title PHP POS Backend Server
echo ==========================================
echo Starting Multi-Tenant POS PHP Backend...
echo Server running on http://localhost:5000
echo Press Ctrl+C to stop the server.
echo ==========================================
C:\xampp\php\php.exe -S localhost:5000 -t backend
pause
