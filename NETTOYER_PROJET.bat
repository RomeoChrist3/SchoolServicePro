@echo off
title Nettoyage FUSIONSTOCK
echo ======================================================
echo       NETTOYAGE DU PROJET FUSIONSTOCK
echo ======================================================
echo.
echo Ce script va supprimer les dossiers lourds (node_modules, release, dist).
echo Cela ne supprimera PAS votre code source.
echo.
echo Pour retravailler sur le projet plus tard, il faudra 
echo lancer la commande "npm install".
echo.
set /p confirm="Voulez-vous continuer ? (O/N) : "

if /i "%confirm%" neq "O" goto cancel

echo.
echo Nettoyage en cours...
echo ------------------------------------------------------

if exist node_modules (
    echo Suppression de node_modules...
    rmdir /s /q node_modules
)

if exist release (
    echo Suppression du dossier release...
    rmdir /s /q release
)

if exist dist (
    echo Suppression du dossier dist...
    rmdir /s /q dist
)

if exist dist-electron (
    echo Suppression du dossier dist-electron...
    rmdir /s /q dist-electron
)

echo ------------------------------------------------------
echo.
echo NETTOYAGE TERMINE !
echo Votre dossier est maintenant tres leger.
pause
exit

:cancel
echo Nettoyage annule.
pause
exit
