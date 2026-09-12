Ets AMANI

Plateforme de supervision, de contrôle opérationnel, de traçabilité et de collaboration interne d'Ets AMANI.

Ets AMANI est une application métier conçue pour centraliser et superviser les opérations internes de l'entreprise, améliorer la traçabilité des activités, faciliter la collaboration entre les utilisateurs et fournir aux responsables une meilleure visibilité sur les opérations réalisées par les agences et les agents.

L'application adopte une architecture Offline-First, permettant de continuer à travailler même lorsque la connexion Internet est limitée ou indisponible. Les données locales peuvent ensuite être synchronisées avec les services cloud configurés lorsque la connectivité est disponible.

«Important : Ets AMANI n'est pas une application bancaire et ne réalise pas de transferts bancaires réels. Elle constitue une plateforme interne de supervision, de contrôle, de gestion opérationnelle, de collaboration et de traçabilité.»

---

🎯 Objectifs

Ets AMANI vise notamment à :

- centraliser les informations opérationnelles ;
- assurer la traçabilité des opérations ;
- faciliter la supervision des agences et des agents ;
- améliorer le contrôle interne ;
- gérer les utilisateurs et leurs permissions ;
- permettre la production et le suivi des rapports ;
- faciliter la communication interne ;
- gérer les données de billetage ;
- calculer et contrôler les commissions ;
- détecter certaines incohérences opérationnelles ;
- conserver les données localement en mode hors ligne ;
- synchroniser les données lorsque la connexion est disponible ;
- fournir une interface adaptée aux ordinateurs et aux appareils mobiles.

---

🏗️ Architecture

L'application repose sur une architecture moderne Offline-First.

                    ┌─────────────────────┐
                    │      Ets AMANI      │
                    │   Interface Web/UI  │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
          React / TypeScript          React Router
                 │
        ┌────────┴────────┐
        │                 │
   IndexedDB/Dexie      Services
        │                 │
        │          ┌──────┴──────┐
        │          │             │
        │       Firebase      Business
        │       /Firestore      Logic
        │
        └──────────┬─────────────┘
                   │
             Capacitor
                   │
            Android Application

Principe Offline-First

L'application privilégie les données locales afin de permettre :

1. le fonctionnement sans connexion ;
2. l'enregistrement local des données ;
3. la consultation des informations disponibles localement ;
4. la mise en file des opérations nécessitant une synchronisation ;
5. la synchronisation lorsque la connexion est rétablie ;
6. la gestion des conflits lorsque nécessaire.

---

🧩 Fonctionnalités principales

Les modules du projet sont organisés autour des besoins opérationnels d'Ets AMANI.

👥 Gestion des utilisateurs

Gestion des profils, rôles et permissions, notamment :

- Administrateur Système ;
- Directeur Général (DG) ;
- Chef d'agence ;
- Comptable ;
- Guichetier ;
- Agent virtuel ;
- Agent Vodae ;
- Agent de change ;
- Chauffeur ;
- Cleaner ;
- Agent polyvalent ;
- Client Ets AMANI ;
- Agent opérateur mobile ;
- Requérant membre Ets AMANI.

L'accès aux fonctionnalités dépend du rôle, des permissions et de l'état de validation du compte.

📊 Supervision et contrôle

Le système permet notamment :

- la supervision des activités ;
- le suivi des opérations ;
- la consultation des rapports ;
- la traçabilité des actions ;
- la gestion des alertes ;
- l'audit des opérations ;
- le contrôle des incohérences.

💵 Billetage

Le module Billetage permet notamment :

- la saisie des billets USD ;
- la saisie des billets CDF ;
- le calcul automatique ;
- la vérification de cohérence ;
- le blocage en cas d'incohérence.

📄 Rapports

Le système permet aux utilisateurs autorisés de :

- créer des rapports ;
- enregistrer des brouillons ;
- modifier les rapports ;
- soumettre les rapports ;
- suivre leur état ;
- consulter les rapports autorisés.

💬 Chat interne

Un système de communication interne est prévu pour permettre :

- les conversations privées ;
- les groupes d'agence ;
- les groupes de service ;
- les communications globales ;
- les messages texte ;
- les images et fichiers ;
- les statuts de message ;
- les messages prioritaires.

💰 Commissions

Le système intègre une logique destinée à :

- calculer les commissions ;
- appliquer les règles configurées ;
- conserver la traçabilité des calculs ;
- permettre leur contrôle.

📱 Numéros internes et supervision des SMS

Une fonctionnalité spécifique est prévue pour identifier et exploiter les messages opérateurs reçus sur les numéros internes configurés par Ets AMANI.

L'objectif est notamment de permettre la comparaison entre les informations provenant des opérateurs et les rapports ou déclarations des agents internes.

Cette fonctionnalité est conçue dans une logique de supervision et de contrôle, et non pour effectuer automatiquement des transactions auprès des opérateurs.

---

🛠️ Technologies utilisées

Frontend

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide React
- Motion
- Recharts

Stockage local

- Dexie.js
- IndexedDB

Dexie fournit une couche d'abstraction permettant de gérer efficacement la base de données locale du navigateur et de l'application.

Backend / Synchronisation

- Firebase
- Cloud Firestore

Firebase est utilisé notamment pour les fonctionnalités nécessitant une synchronisation cloud et certaines données partagées.

Application mobile

- Capacitor
- Android
- Gradle
- Android SDK

L'application Web est encapsulée dans une application Android grâce à Capacitor.

Outils de développement

- Node.js
- npm
- TypeScript
- Git
- GitHub
- GitHub Actions

---

📋 Prérequis

Pour développer le projet localement, il est recommandé d'avoir :

- Node.js 22 ou supérieur
- npm
- Git
- Android Studio ou Android SDK pour le développement Android classique
- JDK 21 pour la compilation Android
- Android SDK API 36

Vérifier les versions :

node --version
npm --version
java --version
git --version

---

🚀 Installation locale

1. Cloner le dépôt

git clone https://github.com/Aimable2025/Ets-AMANI.git
cd Ets-AMANI

«Remplacer l'URL ci-dessus par celle du dépôt officiel si le nom du dépôt est différent.»

---

2. Installer les dépendances

npm install

Pour une installation reproductible dans l'environnement CI :

npm ci

---

3. Configurer les variables d'environnement

Créer un fichier ".env.local" si nécessaire :

GEMINI_API_KEY=your_api_key

Les secrets et clés privées ne doivent jamais être commités dans Git.

Le fichier ".env*" contenant des secrets doit être exclu du dépôt via ".gitignore".

---

💻 Développement

Lancer le serveur de développement :

npm run dev

L'application sera disponible sur l'adresse indiquée par Vite, généralement :

http://localhost:3000

---

🧪 Vérification du projet

Vérification TypeScript

npm run lint

Cette commande exécute le compilateur TypeScript en mode vérification sans générer de fichiers.

Build de production

npm run build

Les fichiers générés sont placés dans :

dist/

Prévisualisation du build

npm run preview

---

📱 Développement Android avec Capacitor

Après avoir construit l'application Web :

npm run build

Synchroniser les fichiers Web avec Android :

npx cap sync android

Ou utiliser :

npm run cap-sync

Pour ouvrir le projet Android :

npm run cap-open-android

Pour lancer l'application sur un appareil ou émulateur compatible :

npm run cap-run-android

---

🤖 Compilation Android avec Gradle

Le projet contient déjà la plateforme Android dans :

android/

La compilation Debug peut être effectuée avec :

cd android
./gradlew assembleDebug

L'APK généré se trouve généralement dans :

android/app/build/outputs/apk/debug/app-debug.apk

GitHub Actions

La compilation Android destinée au dépôt GitHub doit être réalisée avec GitHub Actions.

Le workflow prévu est :

.github/
└── workflows/
    └── android.yml

Le workflow automatise notamment :

1. récupération du dépôt ;
2. installation de Node.js ;
3. installation des dépendances npm ;
4. compilation Vite ;
5. synchronisation Capacitor ;
6. configuration Java ;
7. compilation Gradle ;
8. génération de l'APK ;
9. publication de l'APK comme artefact GitHub Actions.

Cette approche permet notamment de séparer l'environnement de développement mobile de l'environnement de compilation Android.

---

📁 Structure principale

Ets-AMANI/
│
├── .github/
│   └── workflows/
│       └── android.yml
│
├── android/
│   ├── app/
│   ├── gradle/
│   ├── build.gradle
│   ├── variables.gradle
│   ├── settings.gradle
│   └── gradlew
│
├── src/
│   ├── components/
│   ├── contexts/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── utils/
│   └── ...
│
├── public/
│
├── dist/
│   └── ...
│
├── capacitor.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
├── package-lock.json
├── firestore.rules
├── index.html
├── metadata.json
└── README.md

«"dist/" est un répertoire généré automatiquement lors du build et ne doit généralement pas être versionné.»

---

🔐 Sécurité

Ets AMANI applique une approche basée sur les rôles et permissions.

Les données et fonctionnalités sensibles doivent être protégées à plusieurs niveaux :

- contrôle d'accès côté interface ;
- contrôle d'accès dans les services applicatifs ;
- règles Firestore ;
- validation des données ;
- journalisation des opérations ;
- gestion des sessions ;
- contrôle des permissions ;
- séparation des responsabilités.

Les clés API, mots de passe, tokens et autres secrets ne doivent jamais être enregistrés directement dans le code source ou poussés sur GitHub.

---

🔄 Synchronisation

L'application privilégie les données locales pour les opérations Offline-First.

Le principe général est :

Utilisateur
     │
     ▼
Interface Ets AMANI
     │
     ▼
IndexedDB / Dexie
     │
     ├── Hors ligne
     │      └── Stockage local
     │
     └── En ligne
            │
            ▼
       Synchronisation
            │
            ▼
      Firebase / Firestore

La synchronisation doit prendre en compte :

- les opérations en attente ;
- les mises à jour concurrentes ;
- les suppressions ;
- les conflits ;
- l'état de connectivité ;
- la traçabilité des synchronisations.

---

🧭 Principes de conception

Le développement d'Ets AMANI suit plusieurs principes :

Offline-First

L'application doit rester fonctionnelle même avec une connexion limitée.

Sécurité par conception

Les permissions doivent être vérifiées avant l'accès aux fonctionnalités sensibles.

Traçabilité

Les opérations importantes doivent pouvoir être auditées.

Séparation des responsabilités

Les rôles, services et permissions doivent être clairement séparés.

Modularité

Chaque fonctionnalité doit être organisée sous forme de module indépendant lorsque cela est pertinent.

Maintenabilité

Le code doit privilégier :

- TypeScript ;
- composants réutilisables ;
- services spécialisés ;
- logique métier séparée de l'interface ;
- validation stricte ;
- documentation des fonctionnalités importantes.

---

👤 Rôles principaux

Les principaux profils prévus dans l'application comprennent :

Profil| Fonction principale
Administrateur Système| Administration technique et contrôle global du système
Directeur Général| Supervision générale de l'entreprise
Chef d'agence| Gestion et supervision d'une agence
Comptable| Gestion et contrôle comptable
Guichetier| Opérations de guichet
Agent virtuel| Opérations assignées
Agent Vodae| Opérations liées au service concerné
Agent de change| Opérations de change
Chauffeur| Gestion des tâches assignées
Cleaner| Tâches assignées
Agent polyvalent| Exécution des opérations autorisées
Client| Utilisation des services autorisés
Agent opérateur mobile| Opérations liées au service mobile
Requérant membre| Demande d'adhésion soumise à validation

Les permissions effectives dépendent de la configuration du système et de l'état du compte.

---

🗺️ Évolution du projet

Le projet évolue progressivement autour des axes suivants :

- [ ] Finalisation de l'interface utilisateur ;
- [ ] Finalisation du système RBAC ;
- [ ] Finalisation du module Billetage ;
- [ ] Finalisation du module Rapports ;
- [ ] Finalisation du Chat interne ;
- [ ] Finalisation de la synchronisation Offline-First ;
- [ ] Renforcement de l'audit et de la traçabilité ;
- [ ] Finalisation du module de supervision des SMS opérateurs ;
- [ ] Tests fonctionnels ;
- [ ] Tests Android ;
- [ ] Automatisation complète du build APK avec GitHub Actions ;
- [ ] Optimisation des performances ;
- [ ] Tests de sécurité.

---

📜 Licence

Le projet Ets AMANI est un projet logiciel interne.

Sauf indication contraire explicite du propriétaire du projet, le code source, les données, les règles métier, les interfaces et les composants spécifiques à Ets AMANI ne doivent pas être copiés, redistribués ou exploités commercialement sans autorisation.

---

👨‍💻 Développement

Projet : Ets AMANI

Développé et maintenu par Aimable Maombi Bunoti.

«Building systems that improve operational control, traceability and collaboration.»

---

📌 Statut

Projet en développement actif.

Les fonctionnalités, l'architecture et les règles métier peuvent évoluer au fur et à mesure des phases de développement, de test et de validation.
