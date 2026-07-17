# BlockDraft - Kurzanleitung (Architektur)

Dieses Projekt verwandelt einfache Textbeschreibungen in Minecraft-Blaupausen (`.mcfunction`-Dateien) mit Hilfe von Künstlicher Intelligenz. Das System besteht aus zwei Hauptkomponenten: einem Backend (Server) und einem Frontend (Webseite).

## 1. Das Backend (Der Server)
**Technologie:** Node.js (in der Datei `server/index.mjs`)
**Port:** Läuft standardmäßig auf `http://localhost:8787`

Das Backend ist das Gehirn der Anwendung. Wenn du einen Text-Prompt eingibst, macht der Server Folgendes:
1. **Prompt Optimierung:** Es schickt deine Idee an die Gemini AI (`gemini-3.1-flash-lite`), um einen detaillierten Bauplan zu entwerfen.
2. **Kategorisierung & Generierung:** 
   - **Für Gebäude & Fahrzeuge ("Two-Pass Mode"):** Die AI erstellt zuerst einen groben, aus simplen Formen bestehenden Plan (PartPlan). Das Backend berechnet danach lokal die genauen Block-Koordinaten. Das garantiert fehlerfreie Strukturen.
   - **Für Charaktere & Objekte ("Direct Draw"):** Wenn "Force Direct Draw" aktiv ist oder ein Charakter gebaut wird, generiert die AI direkt jeden einzelnen Minecraft-Block.
3. **Validierung:** Das Backend prüft, ob das Modell nicht zu groß ist (max. 5000 Blöcke) und ob es physikalisch verbunden ist (keine fliegenden Blöcke).

## 2. Das Frontend (Die Webseite)
**Technologie:** React, TypeScript, Vite & Three.js (im Ordner `src/`)
**Port:** Läuft standardmäßig auf `http://localhost:5173`

Das Frontend kümmert sich um die Benutzeroberfläche und die 3D-Darstellung:
- **Eingabe:** Hier kannst du deinen Prompt schreiben, Bilder hochladen und Parameter (wie "Force Direct Draw") setzen.
- **3D Viewer:** Das generierte 3D-Modell wird direkt im Browser gerendert (durch Three.js), sodass du es vor dem Download begutachten kannst.
- **Export:** Es übersetzt die Block-Koordinaten in ausführbare Minecraft-Befehle (`.mcfunction`), die du in Minecraft einfügen kannst.

## 3. Umgebungsvariablen & Sicherheit
Alle sensiblen Keys (wie z.B. dein `GEMINI_API_KEY`) müssen in der Datei `.env.local` liegen. Diese Datei ist auf der "Ignore-Liste" von Git (`.gitignore`), was bedeutet, dass deine geheimen Schlüssel niemals versehentlich ins Internet hochgeladen werden.
