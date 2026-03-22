# Škálování: nahrávání a AI zpracování smluv

## Proč to trvá dlouho

Jeden upload spustí pipeline, která volá **OpenAI s celým PDF** (soubor se znovu stáhne z podpisové URL):

1. **Kombinovaný krok** (po optimalizaci): detekce typu PDF (text vs sken) **+** klasifikace dokumentu (úvěr, pojistka, …) v **jednom** volání.
2. **Strukturovaná extrakce** pole podle typu dokumentu — **druhé** volání s PDF.

Dříve to byly **3** plné průchody souborem; teď typicky **2**. Každé volání je řádově **sekundy až desítky sekund** podle velikosti PDF a zatížení OpenAI.

## 100 uživatelů najednou

- **Vercel serverless** škáluje počet **souběžných** funkcí — nečeká se ve frontě na jednom vlákně jako na jednom VPS. Limit je hlavně **OpenAI rate limits** a **kvóty účtu**, ne „jedna CPU“.
- V kódu je **rate limit** na upload (`contracts-upload`, např. 10 pokusů / min / uživatel) — šíření spamu; u placeného tarifu lze číslo zvednout nebo zavést limit **na tenant**.
- **Databáze** (Supabase Postgres) zvládá paralelní INSERTy; bottleneck bývá spíš **Storage + OpenAI**.

## Co dělat, až poroste zátěž

1. **Vercel Pro** (nebo vyšší) — delší `maxDuration` pro `/api/contracts/upload` (v kódu je např. 120 s; na Pro lze zvýšit podle dokumentace).
2. **Asynchronní fronta** (další fáze produktu): odpovědět hned po uložení souboru (`processingStatus: uploaded`), extrakci spustit na pozadí (Inngest, Trigger.dev, Supabase Edge + cron, vlastní worker). Uživatel uvidí „zpracovává se“ a stránka může pollovat detail.
3. **OpenAI** — vyšší tier / Batch API pro neurgentní hromadní zpracování.
4. **Tenant-level limity** — např. max paralelních jobů na firmu podle předplatného.

## OpenAI 429 / TPM (tokens per minute)

Při hlášce typu *Rate limit reached … TPM* jde o **limit tokenů za minutu** na úrovni organizace/API klíče, ne o chybu PDF.

- V kódu (`createResponseWithFile` / `createResponse`) je **automatický retry** s čekáním podle textu *„try again in Xs“* (několik pokusů).
- Pokud limit pořád naráží (mnoho paralelních uploadů, velké PDF, sdílený klíč), řešení je: **počkat minutu**, **omezit paralelní nahrávání**, nebo na [OpenAI rate limits](https://platform.openai.com/account/rate-limits) **zvýšit tier / kvótu**.
- API odpověď může obsahovat `code: "OPENAI_RATE_LIMIT"` a českou zprávu pro uživatele.

## Stručně

Dlouhá doba u jednoho souboru je **normální** u synchronního AI nad celým PDF. Pro desítky až stovky aktivních uživatelů je reálná cesta: **asynchronní zpracování + fronta + vyšší limity u OpenAI a Vercelu**, ne jen „rychlejší server“.
