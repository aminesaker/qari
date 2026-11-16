# Qari — réciter le Coran avec correction vocale (iPhone + Android)

Application gratuite, sans compte ni publicité. On choisit une sourate, on récite, et les mots
se colorent en direct : **vert** = reconnu, **rouge** = autre mot entendu, **orange souligné** = oublié.
Le mode **Masquer** cache le texte et le révèle au fur et à mesure (révision de la mémorisation).

La reconnaissance vocale tourne **entièrement sur le téléphone** (hors ligne, rien n'est envoyé,
aucun coût serveur).

## Comment c'est construit

| Brique | Rôle |
|---|---|
| Expo / React Native (SDK 58) | une seule base de code pour iOS et Android |
| `whisper.rn` (whisper.cpp) | exécute le modèle de reconnaissance sur le téléphone |
| `tarteel-ai/whisper-base-ar-quran` (Apache-2.0) | modèle Whisper entraîné sur la récitation du Coran, converti et compressé (55 Mo) |
| Silero VAD | détecte quand tu parles pour découper l'audio |
| Tanzil (texte uthmani, CC BY 3.0) | texte affiché, non modifié |
| `src/lib/matcher.ts` | moteur maison qui aligne ce qui est entendu avec le texte attendu |

Le moteur gère les différences d'orthographe uthmani / moderne, les lettres isolées
(« alif lam mim »), les répétitions (revenir en arrière n'est pas une faute) et la correction
d'un mot relu. Testé sur tout le Coran : 0,01 % de fausses fautes sur un texte parfait.

## Lancer l'appli sur ton téléphone

L'appli contient du code natif (le modèle vocal) : **elle ne marche pas dans Expo Go**.
Il faut faire un build, dans le cloud avec EAS (pas besoin de Mac ni d'Android Studio).

```bash
npm install
npx eas-cli@latest login          # compte Expo gratuit
npx eas-cli@latest build:configure
# Android : un .apk à installer directement sur le téléphone
npx eas-cli@latest build --platform android --profile preview
# iPhone : nécessite un compte Apple Developer (99 $/an)
npx eas-cli@latest build --platform ios --profile preview
```

Pour publier sur les stores : `--profile production` puis `npx eas-cli@latest submit`.
Google Play : 25 $ une seule fois. App Store : 99 $/an.

## Commandes utiles

```bash
npm test            # tests du moteur de correction
npm run typecheck   # vérification TypeScript
npx expo lint
npm run build:data  # régénère assets/quran.json depuis data/tanzil
bash scripts/convert-model.sh   # régénère le modèle vocal depuis Hugging Face
```

## Arborescence

```
src/app/index.tsx            liste des sourates + « Reprendre »
src/app/recite/[surah].tsx   écran de récitation
src/app/about.tsx            à propos, sources, licences
src/lib/matcher.ts           alignement entendu / attendu
src/lib/arabic.ts            normalisation de l'arabe
src/lib/recognizer.ts        micro + reconnaissance sur le téléphone
src/lib/quran.ts             accès au texte
assets/quran.json            texte généré (6236 versets)
assets/models/               modèle vocal + détection de voix
```

## Limites connues (V1)

- On choisit la sourate et le verset de départ (pas encore de détection automatique de l'endroit).
- Les erreurs fines de tajwid / harakat ne sont pas détectées : on compare les mots.
- Le modèle peut se tromper dans le bruit : un mot « à revoir » n'est pas forcément une faute.
- Le premier lancement prend quelques secondes (chargement du modèle).

## Licences

Texte : Tanzil Project — tanzil.net (CC BY 3.0, copie verbatim). Modèle : Tarteel AI (Apache-2.0).
whisper.cpp / whisper.rn : MIT. Silero VAD : MIT. Police Amiri Quran : SIL OFL 1.1.
