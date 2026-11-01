# Været her

Publiser innholdet i denne mappen på en statisk webserver med HTTPS. Ved lokal utvikling kan du bruke `python3 -m http.server 8000` og åpne http://localhost:8000. Posisjon krever nettlesertillatelse. Ingen bygging eller API-nøkkel er nødvendig.

- Yr/MET Locationforecast (complete) er standard. Open-Meteo kan velges i nedtrekkslisten. Valget lagres lokalt.
- Stedsnavn hentes fra BigDataClouds klienttjeneste. Koordinater vises hvis oppslaget feiler.
- Posisjonen sendes til valgt værtjeneste og BigDataCloud for å hente lokalt vær og stedsnavn.
- Nedbør i timevarselet vises i mm. METs hovedfelt viser neste times nedbør; Open-Meteos hovedfelt viser gjeldende nedbør. «Føles som» vises bare når tjenesten leverer dette.
- Klokkeslett bruker enhetens tidssone. Yr viser prognosen for nærmeste tilgjengelige varseltime.
- Værdata krever nettforbindelse. Service worker lagrer appfilene, ikke værdata. Versjonen er økt slik at eksisterende installasjoner får oppdateringen etter at appen er lastet på nytt.

Datakilder: https://api.met.no/weatherapi/locationforecast/2.0/documentation og https://open-meteo.com/ (CC BY 4.0). Stedsnavn: https://www.bigdatacloud.com/.

Før offentlig drift: Følg METs bruksvilkår (https://api.met.no/doc/TermsOfService). Behold identifiserende Referer ved direkte nettleserkall, og oppgi kontaktinformasjon på nettstedet. For større trafikk anbefales en server/proxy med identifiserende User-Agent og mellomlagring etter METs retningslinjer. Ikke sett User-Agent manuelt i nettleserkoden.

Kontrollert med JavaScript-syntakssjekk og simulerte API-svar for begge værkilder, stedsnavn, kildebytte og tjenestefeil. Faktiske API-kall og posisjonstillatelse må også prøves i nettleser på publisert HTTPS-adresse.


## Versjon 2

- Velg 3, 5, 7 eller 10 dager. Valget huskes på enheten. Langtidsvarselet viser temperatur, vind og vindkast i m/s.
- Open-Meteo leverer opptil 10 viste dager. Yr/MET leverer omtrent ni dager fremover. Appen viser antall tilgjengelige dager hvis perioden er kortere enn valgt. Den bytter ikke værkilde automatisk.
- Døgn i langtidsvarselet følger UTC. Tidene i timevarselet og tidevannstabellen følger enhetens tidssone.
- METs minimum/maksimum beregnes fra tilgjengelige varseltidspunkter, og dagens verdier gjelder resten av døgnet. Vindkast fra MET finnes ikke for alle steder eller hele langtidsperioden. Manglende verdier vises som en strek.
- Flo og fjære for neste 24 timer hentes fra Kartverket (astronomisk tidevann, cm over sjøkartnull). Ingen værbidrag er inkludert. Norskekysten har dekning; manglende data eller nettfeil vises tydelig. Posisjonen sendes også til Kartverket. Dataene skal ikke brukes til navigasjon.
- Månefase og belyst andel beregnes lokalt fra en gjennomsnittlig synodisk måned. Beregningen er en tilnærming, og er uavhengig av nettforbindelse.
- Service worker er oppdatert til v4.

Kartverkets dokumentasjon: https://vannstand.kartverket.no/tideapi_no.html (CC BY 4.0). METs datafelt og begrensninger: https://docs.api.met.no/doc/locationforecast/datamodel.html.

Versjon 2 er kontrollert med syntakssjekk og simulerte API-svar for alle fire varsellengder, begge kilder, vindkast, manglende verdier, tidevann, ugyldig XML, månefase og kildebytte mens en forespørsel pågår. Live API-kall og nettleservisning er ikke verifisert i dette kjøremiljøet. Opplasting til HTTPS-verten ble blokkert av manglende forbindelse til miljøets nettverksproxy; en opprettet Site er ikke det samme som en publisert app.
