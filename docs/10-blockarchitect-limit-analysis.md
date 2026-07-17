# BlockArchitect: Architektur-Analyse von Hinweisen, Grenzen und Limits

## Ausgangspunkt

BlockArchitect macht seine technischen Grenzen im Produkt sichtbar: Der beste Bereich sind kleine bis mittlere, geometrische Bauwerke; grosse Szenen sollen in Teile zerlegt werden; organische Formen, Gesichter, Logos und kleiner Text sind unzuverlässig; Materialien sollen im Prompt konkret genannt werden; die Browser-Vorschau ist eine schnelle Annäherung und nicht die In-Game-Wahrheit. Dazu kommen Galerie-/Review-Hinweise, eine tägliche Gratisquote und eine genaue Exportanleitung. Diese Hinweise sind deshalb nicht nur Marketing, sondern ein Teil des Produktdesigns. Sie reduzieren Fehlversprechen, Kosten, Supportaufwand und Missbrauch.

Referenz: [BlockArchitect.de](https://www.blockarchitect.de/).

## Was steckt technisch hinter den einzelnen Hinweisen?

| Beobachtung bei BlockArchitect | Wahrscheinlicher Architekturgrund | Entscheidung für BlockDraft |
|---|---|---|
| „Sweet spot“ um ca. 20 Blöcke pro Achse | Ein Sprachmodell muss eine räumliche Struktur als viele einzelne Zellen/Operationen ausgeben. Mit wachsender Fläche steigen Tokenzahl, Validierungsfehler und Renderingkosten überproportional. | Als **Soft-Limit** übernehmen: 8–24 Blöcke pro Achse sind der empfohlene Bereich. Das System darf grössere gültige Builds annehmen, warnt aber früh. |
| Grosse Ideen werden sonst zu Miniaturen | Das Modell erkennt „Stadion“ oder „Stadt“ semantisch, kann die gewünschte Massstäblichkeit aber nicht zuverlässig halten. | Nicht stillschweigend verkleinern. Der Nutzer wählt `miniature`, `full` oder `modular_pack`. Bei grossen Ideen erzeugen wir einen Modulplan (z. B. Fundament, Hauptturm, Tor) und weisen darauf hin. |
| Organische Formen, Tiere, Gesichter und kleiner Text sind rough | Architektur-Primitive (Quader, Säulen, Bögen) sind für ein LLM leichter als zusammenhängende gekrümmte Oberflächen oder exakte Pixel-/Buchstabenraster. | Architekturmodus grenzt diese Fälle klar ab. Später optionaler `pixel_art`-Modus; keine Qualitätszusage im Architekturmodus. |
| Materialien explizit nennen | Freie Begriffe wie „Stein“ oder „modern“ sind nicht eindeutig. Eine begrenzte Blockpalette macht das Ergebnis reproduzierbar und reduziert Modellentscheidungen. | Palette vor der Generierung auswählen oder Theme-Preset verwenden. Die aufgelöste Palette wird vor dem Request angezeigt und im BuildSpec gespeichert. |
| Vorschau vereinfacht Glas, Zäune, Lichtquellen und Blockzustände | Eine Browser-3D-Ansicht mit vollständigen Spieltexturen, Orientierungen und Spezialzuständen ist schwerer und langsamer. Proxy-Geometrie ist für den schnellen Blick ausreichend. | Vorschau bleibt bewusst schnell (InstancedMesh). Ein sichtbares „Preview fidelity“-Label und Blockzustands-/Kompatibilitätswarnungen verhindern falsche Erwartungen. Der Export ist die Autorität. |
| Galerie zuerst prüfen | Bereits vorhandene Strukturen sparen AI-Kosten und liefern bessere Beispiele. Gleichzeitig entsteht eine Community-Schleife. | Galerie ohne Login durchsuchbar; „Ähnliche Builds“ und „Remix“ als kostenloser Einstieg. Neue öffentliche Builds erst nach automatischer Prüfung, Featured-Builds zusätzlich manuell. |
| Jede Generierung wird geprüft | Öffentliche Inhalte können Spam, beleidigende Inhalte, geschützte Marken oder schädliche Prompts enthalten. Review schützt Marke und Community. | Automatisierte Safety-/IP-Signale für alle Jobs; manuelle Prüfung nur für öffentliche/Featured-Inhalte oder Grenzfälle. Private Entwürfe bleiben privat. |
| Eine kostenlose Generierung pro Tag | AI-Aufrufe sind variable Kosten und ein offener Endpoint lädt zum Botten ein. Eine Tagesquote ist einfach verständlich. | Im Alpha 1 Textgenerierung pro Tag. Foto-Referenz erhält ein höheres Credit-Gewicht. Quota, Restzeit und Verbrauch werden transparent angezeigt. |
| Fair-Use-/Missbrauchshinweis | Der Betreiber braucht Rate-Limits und eine Notabschaltung, sonst kann eine Kampagne die Marge zerstören. | Prompt-Länge, parallele Jobs, IP-/Account-Signale, Tagesbudget und Kill-Switch serverseitig. Klare, sachliche Policy statt Drohformulierung. |
| `.mcfunction`-Installationsanleitung | Der Wert entsteht erst im Spiel. Jeder zusätzliche Installationsschritt senkt Aktivierung und erhöht Supporttickets. | Edition und Version explizit anzeigen (Alpha: Minecraft Java 1.21.x), Download plus „Befehl kopieren“ und kurze Schritt-für-Schritt-Anleitung. Bedrock erst mit eigenem Export testen. |
| Kommerzielle Nutzung wird ausdrücklich erwähnt | Diese Aussage erhöht die Zahlungsbereitschaft und beseitigt eine zentrale Creator-Unsicherheit. | Lizenztext für originale generierte Strukturen. Keine Zusage für geschützte Figuren/Logos/Marken; bei solchen Prompts Warnung und gegebenenfalls Blockierung. |
| Blockzahl, Abmessungen, Materialien und Zeit werden gezeigt | Messwerte geben Vertrauen und helfen dem Nutzer zu beurteilen, ob das Ergebnis praktisch verwendbar ist. | Diese Werte Pflichtbestandteil von Jobresultat und UI: `blocks`, `dimensions`, `materials`, `compileMs`, Warnungen und Qualitäts-/Confidence-Score. |

## Verbindliche Grenzen für die Alpha

Diese Werte sind bewusst konservativ. Sie können nach Telemetrie angepasst werden, ohne den BuildSpec-Vertrag zu brechen.

### Geometrie und Ausgabe

- Empfohlener Bereich: 8–24 Blöcke je Achse.
- Harte Bounding Box: 32 × 32 × 32.
- Harte Obergrenze: 5.000 gesetzte Blöcke.
- Maximal 200 Build-Operationen und 12 verschiedene Materialien.
- Prompt maximal 600 Zeichen; ein aktiver Generierungsjob pro Nutzer.
- Maximal ein automatischer Reparaturversuch nach Schema-/Validierungsfehler.
- Grössere Wünsche werden in `modular_pack` umgewandelt, nicht still verkleinert.

### Foto-Input

- Ein JPG, PNG oder WebP, maximal 8 MB; clientseitig auf höchstens 1.600 px Kantenlänge verkleinern und Metadaten entfernen.
- Zwei explizite Modi: `reference` (Stil/Form als Vorlage) und `reconstruct` (bestmögliche Annäherung, verdeckte Seiten werden geschätzt).
- Fotojobs zählen im Alpha als 2 Credits (`reference`) bzw. 3 Credits (`reconstruct`), weil Visionanalyse und Nachbearbeitung teurer sind.
- Originalfoto standardmässig nach Verarbeitung löschen; temporäre Artefakte spätestens nach 24 Stunden entfernen.
- Niemals automatisch in die öffentliche Galerie übernehmen.

### Kosten- und Abuse-Schutz

- Quota vor Jobstart reservieren, bei technischem Fehler automatisch zurückgeben.
- Rate-Limit pro Account und IP; Payload-Grösse, Prompt und Timeout serverseitig nochmals prüfen.
- Provider-Key nur im Server/Cloud Function, nie im Browser.
- Kosten- und Fehlertelemetrie pro Job: Provider, Tokens, Latenz, Blockzahl, Validatorfehler, Reparaturversuch und Ergebnisstatus.

## UI-Texte, die wir übernehmen sollten

Die Hinweise müssen an der Stelle erscheinen, an der eine Fehlentscheidung entsteht, nicht nur in einer FAQ:

1. Unter dem Prompt: „Beste Ergebnisse: ein Bauwerk, 8–24 Blöcke je Achse.“
2. Neben der Grössenauswahl: „Grössere Szene? Modular Pack erzeugt mehrere kombinierbare Teile.“
3. Neben der Palette: „Materialien konkret auswählen; unklare Begriffe werden als Theme aufgelöst.“
4. Beim Foto-Upload: „Foto dient als Referenz. Verdeckte Seiten und exakte Blockzustände werden geschätzt.“
5. Vor dem Start: Karte mit erwarteter Blockzahl, Abmessungen, Materialien, Creditverbrauch und Warnungen.
6. In der Vorschau: „Schnellvorschau – Spezialblöcke können vereinfacht dargestellt sein. Export ist massgeblich.“
7. Beim Export: Edition/Version, Installationsschritte, Dateiname und kopierbarer Befehl.

## Was wir bewusst besser machen als die Vorlage

1. **Keine stille Skalierung:** Die gewählte Darstellung (`miniature`, `full`, `modular_pack`) bleibt im Ergebnis sichtbar.
2. **Vorab-Validierung:** Palette, Zielgrösse und geschätzte Kosten werden vor dem AI-Call geprüft.
3. **Strukturierter Vertrag:** Das Modell darf kein beliebiges JSON erzeugen, sondern nur ein validiertes BuildSpec mit Bounds, Palette und Operationen.
4. **Reproduzierbarkeit:** Seed, Provider, Modellversion und BuildSpec-Version werden gespeichert, damit ein Ergebnis erneut kompiliert werden kann.
5. **Remix als echter Fork:** Ein Remix referenziert den Ursprungsjob, kopiert ihn in einen neuen Entwurf und verändert niemals das Original.
6. **Editionstrennung:** Java- und Bedrock-Export sind getrennte Capabilitys; keine pauschale „funktioniert überall“-Aussage.

## Abnahmekriterien und Telemetrie

- Kein gültiger Request überschreitet Bounding Box, Block- oder Materiallimit.
- Jede Limitwarnung ist vor dem AI-Aufruf sichtbar und testbar.
- Ein grosser Prompt liefert einen Modulplan oder eine verständliche Ablehnung, nie ein unmarkiertes Miniaturergebnis.
- Foto- und Textjobs zeigen unterschiedliche Creditkosten.
- Vorschau und Export enthalten dieselben Block-/Dimensionsmetriken.
- Für 100 Testprompts werden Erfolgsquote, Validatorfehler, Reparaturquote, mittlere Latenz, Kosten pro Job und Abbruchrate erfasst.
- Safety-/IP-Treffer werden protokolliert, aber private Prompts nicht öffentlich gelistet.

## Architektur-Fazit

Die Grenzen von BlockArchitect sind im Kern vernünftig: Sie schützen Modellqualität, Browser-Performance und variable AI-Kosten. Wir sollten sie nicht als starre Produktmauer kopieren, sondern als abgestufte, erklärbare Leitplanken umsetzen. Die wichtigste Differenz ist die explizite Wahl zwischen Miniatur, Vollgrösse und modularer Zerlegung. Damit bleibt BlockDraft ehrlich, planbar und für spätere grössere Builds erweiterbar.
