import { ScrollView, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function About() {
  const c = useTheme();
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: Spacing.four, gap: Spacing.two }}>
      <Text style={[styles.h, { color: c.accent }]}>Gratuit, pour tout le monde</Text>
      <Text style={[styles.p, { color: c.text }]}>
        Pas de compte, pas de publicité, pas d’abonnement. La reconnaissance de ta voix se fait entièrement sur ton
        téléphone : aucun enregistrement n’est envoyé sur internet, et l’application fonctionne hors ligne.
      </Text>
      <Text style={[styles.h, { color: c.accent }]}>Comment ça marche</Text>
      <Text style={[styles.p, { color: c.text }]}>
        Choisis une sourate, touche le verset de départ puis appuie sur le micro. Les mots deviennent verts quand ils sont
        reconnus, rouges quand un autre mot a été entendu, et orange soulignés quand ils semblent oubliés. En mode
        « Masquer », le texte apparaît au fur et à mesure : idéal pour réviser ce que tu as mémorisé.
      </Text>
      <Text style={[styles.p, { color: c.text }]}>
        La reconnaissance automatique peut se tromper, surtout dans un endroit bruyant : un mot marqué à revoir n’est pas
        forcément une faute. Cette application aide à réviser, elle ne remplace pas un enseignant.
      </Text>
      <Text style={[styles.h, { color: c.accent }]}>Sources et licences</Text>
      <Text style={[styles.p, { color: c.text }]}>Texte du Coran : Tanzil Project (tanzil.net), texte uthmani, licence Creative Commons Attribution 3.0. Le texte n’a pas été modifié.</Text>
      <Text style={[styles.p, { color: c.text }]}>Reconnaissance vocale : modèle tarteel-ai/whisper-base-ar-quran (licence Apache 2.0), exécuté avec whisper.cpp / whisper.rn (licence MIT).</Text>
      <Text style={[styles.p, { color: c.text }]}>Détection de la voix : Silero VAD (licence MIT).</Text>
      <Text style={[styles.p, { color: c.text }]}>Police : Amiri Quran, par Khaled Hosny (SIL Open Font License 1.1).</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 17, fontWeight: '700', marginTop: Spacing.three },
  p: { fontSize: 15, lineHeight: 22 },
});
