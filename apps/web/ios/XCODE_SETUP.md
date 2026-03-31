# Aidvisora iOS - Xcode lokalni prostredi

Tento navod je pro **lokalni beh a debug v Xcode**. Pro App Store / TestFlight pouzij `APP_STORE.md`.

## 1. Jedina spravna cesta projektu

- Kanonicka cesta iOS projektu je `~/Developer/Aidvisora/apps/web/ios/App/App.xcodeproj`.
- Neotevirej duplicitni kopie z `Documents/...`.
- Pro otevreni pouzivej bud:
  - Finder -> `apps/web/ios/App/App.xcodeproj`
  - nebo z terminalu v `apps/web`: `pnpm cap:open:ios`

## 2. Dva rezimy iOS behu

### Produkcni web v appce

Pouzij, kdyz chces rychle overit:

- ze se appka otevre,
- nativni shell,
- deep linky,
- OAuth navrat,
- share extension,
- build v simulátoru nebo na iPhonu.

Postup:

```bash
cd ~/Developer/Aidvisora/apps/web
pnpm cap:sync
```

Tento rezim nacita `https://www.aidvisora.cz/prihlaseni?native=1`.

### Lokalni frontend pres localhost

Pouzij, kdyz ladis webovy frontend a chces hned videt lokalni zmeny v appce.

Postup:

```bash
cd ~/Developer/Aidvisora/apps/web
pnpm dev
```

V druhem terminalu:

```bash
cd ~/Developer/Aidvisora/apps/web
pnpm cap:dev
```

Tento rezim prepne WebView na `http://localhost:3000/prihlaseni?native=1`.

## 3. Doporuceny postup pri kazdem otevreni Xcode

1. Zkontroluj, ze jsi v kanonicke kopii repa.
2. Po `git pull` nebo zmene zavislosti spust `pnpm install` z korene repa.
3. Rozhodni rezim:
   - produkce v appce -> `pnpm cap:sync`
   - localhost -> `pnpm dev` a pak `pnpm cap:dev`
4. Otevri `App.xcodeproj`.
5. V Xcode proved:
   - `File > Packages > Reset Package Caches`
   - `File > Packages > Resolve Package Versions`
   - `Product > Clean Build Folder`
6. Zvol scheme `App`.
7. Pak teprve `Run`.

## 4. Co v Xcode pouzivat

- Primarni scheme/target: `App`
- Vedlejsi target: `AidvisorShareExtension`
- Pro bezny debug nepouzivej `Release`
- Pro OAuth, kameru, share extension a push preferuj fyzicky iPhone
- Pro rychly UI/build debug staci simulator

## 5. Signing pro lokalni beh

U obou targetu:

- `Signing & Capabilities`
- `Automatically manage signing`
- stejny `Team`

To plati pro:

- `App`
- `AidvisorShareExtension`

## 6. Swift Package Manager a caste chyby

Pokud Xcode hlasi chyby kolem `CapApp-SPM`, postupuj vzdy takto:

```bash
cd ~/Developer/Aidvisora
pnpm install
cd apps/web
pnpm cap:sync
```

Pak v Xcode:

1. `File > Packages > Reset Package Caches`
2. `File > Packages > Resolve Package Versions`
3. `Product > Clean Build Folder`
4. `Cmd + B`

Poznamka: repo uz obsahuje patch pro `@supernotes/capacitor-send-intent`, takze po `pnpm install` musi byt Swift dependencies konzistentni.

## 7. Co neni problem Xcode prostredi

Tyto problemy obvykle nejsou chyba Xcode setupu:

- Google OAuth se nevrati zpet do appky
- bila obrazovka po auth
- spatny Supabase redirect
- chyba session exchange
- problem na Vercelu nebo produkcnim webu

To patri do vrstvy:

- web aplikace,
- OAuth flow,
- deep link bridge,
- server deploye.

## 8. Kratky rozhodovaci tahak

- Chci jen spustit iOS appku: `pnpm cap:sync`
- Chci ladit frontend lokalne: `pnpm dev` + `pnpm cap:dev`
- Xcode hlasi SPM chybu: reset caches + resolve packages + clean build
- Appka se sestavi, ale auth nefunguje: neni to primarne Xcode problem
