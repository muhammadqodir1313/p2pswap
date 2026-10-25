# PeerSwap — Loyiha Funksionalligi, Joriy Bosqich (Stage) va Rivojlanish Yo‘l Xaritasi

**Hujjat sanasi:** 2026-yil 20-oktabr  
**Loyiha nomi:** PeerSwap (P2P Bilim va Ko‘nikma Almashish Platformasi)  
**Texnologiyalar:** React 19, TypeScript, TanStack Start / Router, Firebase Authentication, Cloud Firestore, Firebase Cloud Functions (2nd Gen), Tailwind CSS v4, Lucide Icons  
**Maqsad:** Foydalanuvchilar o‘rtasida pullik to‘lovlarsiz, dars o‘tish evaziga o‘rganish (P2P) va PeerPoint balansi orqali ishlovchi barqaror ekotizim.

---

## 1. Loyihaning Joriy Holati: Qaysi Bosqichda (Stage)?

PeerSwap loyihasi hozirgi kunda **Stage 2 (Xavfsiz Obuna va Iqtisodiyot Arxitukturasini Kuchaytirish) bosqichini to‘liq yakunlagan** hamda qat’iy **Mustaqil Xavfsizlik Auditi (QA & Security Audit)** dan o‘tgan holatda turibdi.

### Bosqichlar bo‘yicha xronologiya va holat:

| Bosqich (Stage)   | Nomi va Maqsadi                                            |      Holati      | Natija                                                                                                                                                                                                                                                                                                                                                                     |
| :---------------- | :--------------------------------------------------------- | :--------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage 0**       | **Asosiy UI va MVP P2P Almashinuv**                        |    TUGATILGAN    | Sayt dizayni, ro‘yxatdan o‘tish, profil, ko‘nikmalar, kalendar, chat va video xona skeleti yaratilgan.                                                                                                                                                                                                                                                                     |
| **Stage 1**       | **Persistent Firestore Chat Migratsiyasi**                 |    TUGATILGAN    | Chat xabarlari `localStorage`dan Cloud Firestore subkolleksiyasiga (`swap_sessions/{id}/messages`) o‘tkazildi. Real-vaqtli sinxronizatsiya (`onSnapshot`), server timestamplari, xabarlarni takrorlanishdan himoyalash (`seenIds`) va to‘liq avtorizatsiya himoyasi ta’minlandi.                                                                                           |
| **Stage 2**       | **Xavfsiz Tariflar (Subscription) va Server Iqtisodiyoti** |    TUGATILGAN    | Mijoz (brauzer) tomonidan `profiles/{uid}.plan` yoki `peercoins` maydonlarini o‘zboshimchalik bilan o‘zgartirish butunlay taqiqlandi. Pullik obunalarni xarid qilish soxtalashtirilishidan himoyalandi, Click/Payme integratsiyasi kutilayotgani haqida oshkora UI yaratildi, haftalik dars limitlari va ballar hisob-kitobi Cloud Functions tranzaksiyalariga o‘tkazildi. |
| **Stage 2 Audit** | **Mustaqil Xavfsizlik va QA Auditi**                       |    TUGATILGAN    | `firestore.rules`, Cloud Functions, Direct Firestore Fallback va UI to‘liq tekshirildi (Privilege Escalation, Idempotency, Participant Verification bo‘yicha 0 ta xavfsizlik kemtigi).                                                                                                                                                                                     |
| **Stage 3**       | **To‘lov Gateway (Click / Payme / Uzum) Integratsiyasi**   | REJALASHTIRILGAN | Haqiqiy to‘lov tizimlari webhooklarini Cloud Functions orqali ulash va to‘lovdan so‘ng Premium/Pro tariflarini avtomat yoqish.                                                                                                                                                                                                                                             |
| **Stage 4**       | **SSR va Nitro Production Build Optimizatsiyasi**          | REJALASHTIRILGAN | TanStack Start SSR hydration va production build jarayonini yakuniy sayqallash.                                                                                                                                                                                                                                                                                            |

---

## 2. Hozirgi Kunda Mavjud Bo‘lgan To‘liq Funksiyalar Ro‘yxati

Hozirgi vaqtda PeerSwap platformasida quyidagi barcha funksiyalar to‘liq ishchi holatda va sinovdan o‘tgan:

### A. Autentifikatsiya va Foydalanuvchi Boshqaruvi

- **Google OAuth orqali bir bosqichli kirish:** Google hisob yordamida tezkor autentifikatsiya.
- **Email va Parol orqali ro‘yxatdan o‘tish (`/signup`) va kirish (`/login`):** Parol murakkabligi va email tekshiruvi.
- **Avtomatik Profil Yaratilishi (`ensureUserProfile`):** Yangi foydalanuvchiga dastlabki **10 PeerPoint** taqdim etiladi va uning tarifi doim `free` qilib belgilanadi.
- **Himoyalangan Marshrutlar (`useRequireAuth`):** Tizimga kirmagan mehmonlar avtomatik ravishda `/login` sahifasiga yo‘naltiriladi.
- **Tizimdan chiqish (Sign Out):** Sessiyani tozalash va xavfsiz chiqish.

### B. Ko‘nikmalar Boshqaruvi va Aqlli Moslashtirish (Smart Matching)

- **"Men o‘rgataman" (Teach) va "Men o‘rganaman" (Learn):** Foydalanuvchi profilida o‘zi dars berishi mumkin bo‘lgan va o‘rganmoqchi bo‘lgan ko‘nikmalarni kiritadi (`/profile`).
- **Ikki tomonlama moslik algoritmi (`matchScore`):**
  - Foydalanuvchi A va Foydalanuvchi B o‘rtasidagi ko‘nikmalarni o‘zaro solishtiradi.
  - Ikki tomonlama to‘liq moslik bo‘lsa — 95% Moslik nishoni; bir tomonlama bo‘lsa — 60% nishoni beriladi (`/matches`).
- **Aqlli qidiruv va filtrlash (`SkillSearchFilter`):** Dasturlash, tillar, dizayn, biznes toifalari bo‘yicha tezkor saralash.
- **AI Match tavsiyalari (`AiMatchFinder`):** Mos keluvchi hamkorlar bo‘yicha shaxsiy tavsiyalar yaratish.

### C. Dars Sessiyalari va Almashinuv So‘rovlari (`/sessions`)

- **Almashinuv So‘rovi Yuborish (`callCreateSwapRequest`):** Hamkorga taklif yuboriladi, sessiya `pending` holatda ochiladi.
- **Haftalik Kvota Nazorati (Server-side Quota Check):**
  - Free tarifi: haftasiga 3 ta dars;
  - Premium tarifi: haftasiga 15 ta dars;
  - Pro tarifi: cheksiz darslar.
  - Agar kvota tugagan bo‘lsa, server so‘rovni rad etadi va foydalanuvchiga ogohlantirish oynasini ko‘rsatadi.
- **So‘rovlarni Qabul Qilish yoki Rad Etish:** Hamkor o‘z kabinetida kelgan so‘rovni `accepted` qilishi yoki bekor qilishi mumkin.

### D. Real-Vaqtli Jonli Dars Chati (`RealtimeSessionChat`)

- **Doimiy Saqlanuvchi Firestore Chati:** Xabarlar `swap_sessions/{sessionId}/messages` ostida xavfsiz saqlanadi.
- **Xavfsiz Kirish Ruxsati:** Faqat darsning ikki ishtirokchisi (yoki platforma administratori) yozishmalarni o‘qiy oladi va xabar yoza oladi. Begonalar kira olmaydi (`isSessionParticipant`).
- **Dars Vaqtini Taklif Qilish (Proposal Card):** Chat ichida dars vaqti va linkini taklif qilish, taklifni qabul qilish yoki rad etish.
- **Yuklanish, Xatolik va Bo‘sh Holat UI:** Tarmoq uzilganda yoki xabar bo‘lmaganda tushunarli indikatorlar.

### E. Video Dars Xonasi (`VideoSessionModal`)

- **WebRTC Video va Audio Aloqa:** Hamkor bilan yuzma-yuz jonli video dars o‘tish.
- **Kamera va Mikrofoni boshqarish:** Ovozni o‘chirish, kamerani almashtirish.
- **Ekran Namoyishi (Screen Share):** Dars materiallarini taqdimot qilish.

### F. Adolatli PeerPoint Iqtisodiyoti va Ikki Tomonlama Yakunlash (Settlement)

- **Ikki Tomonlama Tasdiqlash (Dual Confirmation):** Dars o‘tgach, har ikkala ishtirokchi qatnashganini tasdiqlashi shart (`requester_confirmed` va `partner_confirmed`).
- **Server Tranzaksiyasi orqali Ball O‘tkazish (`completeSession`):**
  - O‘quvchidan **1 PeerPoint yechiladi**;
  - O‘qituvchiga **1 PeerPoint qo‘shiladi**;
  - Sessiya holati `completed` qilinadi.
- **Idempotentlik:** Bir xil dars uchun ballar hech qachon 2 marta o‘tkazilmaydi.
- **No-Show va Firibgarlikdan Himoya:** Agar hamkor darsga kelmasa, foydalanuvchi "No-show" belgilaydi. Hech qanday ball yechilmaydi va ma’muriyatga avtomatik shikoyat (`reports`) tushadi.
- **Haftalik Avtomatik Qayta Tiklash (`weeklyReset`):** Har dushanba soat 00:00 da (Toshkent vaqti) barcha foydalanuvchilarning haftalik dars kvotasi avtomatik 0 ga tushirilib yangilanadi.
- **48 Soatlik Nazorat (`autoResolveStaleSessions`):** Bir tomon tasdiqlab, ikkinchi tomon 48 soat javob bermasa, dars admin tekshiruviga yuboriladi.

### G. Interaktiv Kalendar (`/calendar`)

- **Bo‘sh Vaqt Slotlari E’lon Qilish (`calendar_slots`):** O‘rgatish yoki o‘rganish uchun ochiq slot ochish.
- **Slotga Yozilish (Join Slot):** Boshqa foydalanuvchi e’lon qilingan vaqtga o‘zini biriktirishi.
- **Slot Chati va Yakunlash:** Har bir slotning alohida ichki xabar almashinuvi mavjud.

### H. Tariflar va Obuna Sozlamalari (`/subscription`)

- **Rejalarning Shaffof Ko‘rinishi:** Bepul (3 ta dars), Premium (15 ta dars), Pro (cheksiz).
- **Soxta To‘lovlarning Yo‘qligi:** Tizim to‘lov qabul qilindi deb aldamaydi; Click / Payme integratsiyasi kutilayotgani va qiziqish bildirish so‘rovi yuborilishi ochiq ko‘rsatiladi.
- **Xavfsiz Qaytarish (Downgrade to Free):** Foydalanuvchi istalgan vaqtda bepul tarifga qayta oladi.

### I. Administrator Paneli (`/admin`)

- **Faqat vakolatli adminlar uchun:** `farhodjonovichm1301@gmail.com` va maxsus tokenli adminlar kira oladi.
- **Foydalanuvchilar Statistikasi:** Ro‘yxatdan o‘tgan a’zolar, faol darslar va ballar aylanmasi.
- **Shikoyatlarni Ko‘rib Chiqish (Reports Resolution):** No-show yoki qoidabuzarlik haqidagi xabarlarni hal etish.
- **Foydalanuvchi Tarifini Belgilash (`adminSetUserPlan`):** Admin tomonidan foydalanuvchi tarifini qonuniy o‘zgartirish.

---

## 3. Kelgusida Qo‘shilishi Rejalashtirilgan Funksiyalar (Roadmap)

PeerSwap platformasini to‘laqonli tijoriy va xalqaro miqyosdagi ta’lim tarmog‘iga aylantirish uchun quyidagi imkoniyatlar rejalashtirilgan:

### 1. Haqiqiy Mahalliy To‘lov Tizimlari Integratsiyasi (Stage 3)

- **Click Merchant API & Payme Business:**
  - O‘zbekiston foydalanuvchilari uchun so‘mda xavfsiz to‘lov qilish (plastik kartalar: Uzcard / Humo).
  - Cloud Functions orqali to‘lov webhooklarini tekshirish (MD5/SHA1 signaturalar tekshiruvi).
  - To‘lov muvaffaqiyatli o‘tgach, `profiles/{uid}.plan` ni avtomatik tarzda `premium` yoki `pro` ga oshirish.
- **Uzum Bank va Xalqaro To‘lovlar (Stripe):**
  - Chet eldagi foydalanuvchilar uchun Visa / Mastercard orqali PeerPoint xarid qilish imkoniyati.

### 2. Push-Bildirishnomalar va Real-Vaqt Ogohlantirishlari (FCM)

- **Firebase Cloud Messaging (FCM):**
  - Foydalanuvchiga yangi almashinuv so‘rovi kelganda telefoniga yoki brauzeriga xabarnoma yuborish.
  - Hamkor chatda yangi xabar yozganda yoki dars vaqti yaqinlashganda (masalan, 15 daqiqa oldin) eslatma berish.
- **Telegram Bot Integratsiyasi:**
  - Foydalanuvchi profilini Telegram boti bilan bog‘lab, saytga kirmasdan ham so‘rovlarni qabul qilish yoki rad etish imkoniyati.

### 3. Barqaror WebRTC Aloqasi uchun TURN Serverlari

- Hozirda WebRTC bepul STUN serverlaridan foydalanadi. Murakkab korporativ yoki mobil internet tarmoqlarida (NAT / Symmetric Firewall ortida) ulanish uzilishining oldini olish uchun xususiy **TURN (Coturn yoki Twilio Network Traversal)** serverlarini ulash.

### 4. Baholash Tizimi, Ko‘nikma Sertifikatlari va Gamifikatsiya

- **Hamkorlik Reytingi va Sharhlar Matritsasi:** Darsdan so‘ng qoldirilgan 5 yulduzli baholarni profil sahifasida ommaviy ko‘rsatish.
- **PeerSwap Skill Badges:** 5 ta muvaffaqiyatli dars o‘tgan foydalanuvchiga "Tajribali ustoz" (Verified Mentor) nishonini berish.
- **Yutuqlar Tizimi (Achievements):** Birinchi dars, ketma-ket 3 hafta faollik, yangi til o‘rgatish kabi yutuqlar uchun qo‘shimcha bonus PeerPointlar berish.

### 5. Dars Materiallarini Almashish va Fayllar Xotirasi

- **Firebase Cloud Storage Integratsiyasi:**
  - Dars davomida PDF kitoblar, taqdimotlar, kod namunalari va skrinshotlarni xavfsiz yuklash va chat orqali almashish.

### 6. PWA (Progressive Web App) va Mobil Moslashuvchanlik

- Platformani smartfonda ilova kabi o‘rnatib olish (`Add to Home Screen`), oflayn kesh va tezkor ishga tushishni ta’minlash.

---

## 4. Xavfsizlik Qoidalari va Arxitektura Xulosasi

```
                                      [ Foydalanuvchi Brauzeri ]
                                                  │
                                                  ▼
                         ┌──────────────────────────────────────────────────┐
                         │              Firestore Security Rules            │
                         │  - plan, peercoins, weekly_lessons o'zgartirish   │
                         │    mijoz uchun MUTLAQ TAQIQLANGAN                │
                         │  - Chat va Sessiyalar faqat ishtirokchilar uchun │
                         └──────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                                      [ Cloud Firestore Baza ]
                                                  ▲
                                                  │ (Faqat Server Admin SDK orqali)
                                                  │
                         ┌──────────────────────────────────────────────────┐
                         │          Firebase Cloud Functions (2nd Gen)      │
                         │  - createSwapRequest: Kvota va limit tekshiruvi  │
                         │  - confirmSessionAttendance: No-show va ishtirok │
                         │  - executeSessionSettlementTransaction: ACID     │
                         │    tranzaksiya orqali ballarni adolatli o'tkazish│
                         │  - weeklyReset: Haftalik limitlarni yangilash    │
                         └──────────────────────────────────────────────────┘
```

Loyihaning kod bazasi to‘liq tartiblangan, barcha TypeScript va ESLint tekshiruvlaridan muvaffaqiyatli o‘tgan hamda kelgusi to‘lov va kengaytirish bosqichlariga to‘liq tayyor.
