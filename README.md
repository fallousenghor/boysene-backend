# 🔧 Quincaillerie Backend API

Backend NestJS complet pour la gestion de quincaillerie.

---

## 🚀 Stack Technique

| Couche | Technologie |
|--------|-------------|
| Framework | NestJS 10 + TypeScript |
| ORM | Prisma 5 |
| Base de données | PostgreSQL (Neon) |
| Auth | JWT + Passport |
| PDF | PDFKit |
| WhatsApp | Meta Business API |
| Stockage | Cloudinary |
| Déploiement | Docker + VPS Ubuntu |

---

## 📁 Structure du Projet

```
src/
├── auth/           # JWT, login, refresh, profil
├── users/          # CRUD utilisateurs
├── roles/          # Rôles + permissions
├── customers/      # Clients + historique
├── suppliers/      # Fournisseurs + historique
├── categories/     # Catégories produits
├── brands/         # Marques produits
├── products/       # Produits + code-barres
├── stocks/         # Mouvements stock + inventaire
├── purchases/      # Achats fournisseurs + réception
├── sales/          # Ventes + paiements automatiques
├── payments/       # Paiements multi-modes
├── invoices/       # Facturation PDF automatique
├── whatsapp/       # Envoi WhatsApp automatique
├── dashboard/      # KPIs + graphiques
├── reports/        # Rapports + export Excel
├── settings/       # Paramètres système
├── prisma/         # Service Prisma global
└── common/         # Guards, filtres, décorateurs
```

---

## ⚙️ Installation

### 1. Cloner et installer
```bash
git clone <repo>
cd quincaillerie-backend
npm install
```

### 2. Configurer l'environnement
```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

### 3. Base de données
```bash
# Générer le client Prisma
npm run prisma:generate

# Appliquer les migrations
npm run prisma:migrate

# Peupler avec données initiales
npm run prisma:seed
```

### 4. Lancer en développement
```bash
npm run start:dev
```

L'API sera disponible sur : `http://localhost:3000/api/v1`  
La documentation Swagger : `http://localhost:3000/api/docs`

---

## 🐳 Déploiement Docker

```bash
# Build et lancer
docker-compose up -d

# Voir les logs
docker-compose logs -f api

# Migrations en prod
docker-compose exec api npx prisma migrate deploy
docker-compose exec api npm run prisma:seed
```

---

## 🔐 Authentification

Toutes les routes (sauf `/auth/login`) nécessitent un header :
```
Authorization: Bearer <access_token>
```

**Compte admin par défaut :**
- Email : `admin@quincaillerie.com`
- Mot de passe : `Admin@123`

### Endpoints Auth
```
POST /api/v1/auth/login          # Connexion
POST /api/v1/auth/refresh        # Rafraîchir token
POST /api/v1/auth/logout         # Déconnexion
GET  /api/v1/auth/profile        # Profil connecté
PATCH /api/v1/auth/change-password
```

---

## 📋 Endpoints API Complets

### Utilisateurs & Rôles
```
GET/POST /api/v1/users
GET/PATCH/DELETE /api/v1/users/:id
GET/POST /api/v1/roles
GET /api/v1/roles/permissions
```

### Produits & Stock
```
GET/POST /api/v1/products
GET /api/v1/products/low-stock
GET /api/v1/products/barcode/:barcode
GET/PATCH/DELETE /api/v1/products/:id

POST /api/v1/stocks/movement       # Entrée/sortie manuelle
POST /api/v1/stocks/adjust         # Ajustement
GET  /api/v1/stocks/movements      # Historique
GET  /api/v1/stocks/inventory      # Inventaire complet
GET  /api/v1/stocks/alerts         # Alertes stock faible
```

### Achats
```
GET/POST /api/v1/purchases
GET/PATCH /api/v1/purchases/:id
POST /api/v1/purchases/:id/confirm    # Confirmer commande
POST /api/v1/purchases/:id/receive    # Réceptionner
POST /api/v1/purchases/:id/cancel
```

### Ventes
```
GET/POST /api/v1/sales
GET /api/v1/sales/:id
POST /api/v1/sales/:id/payment    # Ajouter paiement
POST /api/v1/sales/:id/cancel
```

### Facturation PDF
```
GET /api/v1/invoices
GET /api/v1/invoices/:id/pdf
GET /api/v1/invoices/sale/:saleId/pdf
GET /api/v1/invoices/purchase/:purchaseId/pdf
POST /api/v1/invoices/:id/send
```

### WhatsApp
```
POST /api/v1/whatsapp/send                       # Message libre
POST /api/v1/whatsapp/sale/:saleId               # Envoyer facture vente
POST /api/v1/whatsapp/purchase/:purchaseId       # Envoyer bon commande
POST /api/v1/whatsapp/payment/:saleId            # Envoyer reçu paiement
POST /api/v1/whatsapp/reminder/:customerId       # Relance crédit
GET  /api/v1/whatsapp/history                    # Historique envois
```

### Tableau de Bord
```
GET /api/v1/dashboard                  # Dashboard complet
GET /api/v1/dashboard/stats            # KPIs (?period=day|week|month|year)
GET /api/v1/dashboard/sales-chart      # Courbe ventes (?days=30)
GET /api/v1/dashboard/top-products
GET /api/v1/dashboard/top-customers
GET /api/v1/dashboard/low-stock
GET /api/v1/dashboard/activity
```

### Rapports & Exports
```
GET /api/v1/reports/sales
GET /api/v1/reports/purchases
GET /api/v1/reports/stock
GET /api/v1/reports/customers
GET /api/v1/reports/payments
GET /api/v1/reports/profit-loss
GET /api/v1/reports/:type/export/excel    # Export Excel
```

---

## 💬 Configuration WhatsApp

1. Créer une app sur [Meta for Developers](https://developers.facebook.com)
2. Activer WhatsApp Business API
3. Configurer dans `.env` :
   ```env
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_ACCESS_TOKEN=your_permanent_token
   ```
4. L'envoi se déclenche automatiquement après :
   - Validation d'une vente → facture client
   - Confirmation d'un achat → bon de commande fournisseur
   - Enregistrement d'un paiement → reçu client

---

## 📊 Rôles & Permissions

| Rôle | Accès |
|------|-------|
| ADMIN | Tout |
| MANAGER | Produits, stocks, achats, ventes, rapports |
| CASHIER | Ventes, paiements, facturation |
| WAREHOUSE | Stocks, inventaire |

---

## 🔄 Flux Automatiques

```
Vente créée
  └─→ Stock décrémenté automatiquement
  └─→ Mouvement stock enregistré
  └─→ Facture générée automatiquement
  └─→ WhatsApp envoyé au client (si numéro renseigné)

Achat confirmé
  └─→ WhatsApp envoyé au fournisseur

Achat reçu
  └─→ Stock incrémenté automatiquement
  └─→ Mouvement stock enregistré
```
