#!/usr/bin/env python3
"""Construit assets/quran.json à partir des fichiers Tanzil.

Usage : python3 scripts/build-quran-data.py <dossier_tanzil> assets/quran.json

Le dossier doit contenir :
  - quran-uthmani.txt       (texte affiché, Tanzil, format "sourate|verset|texte")
  - quran-simple-clean.txt  (orthographe moderne, sert aux variantes de comparaison)
  - quran-data.js           (métadonnées des sourates)

Le texte Tanzil n'est jamais modifié : on se contente de séparer la basmala du
premier verset (affichée à part) et de rattacher les signes de pause au mot précédent.
"""
import json
import re
import sys
from pathlib import Path

MARK_RE = re.compile(r"^[ۖ-ۭ؀-؅]+$")
DIAC_RE = re.compile(r"[ؐ-ًؚ-ٟۖ-ۭـ]")

# Lettres isolées (huruf muqatta'at) : le récitant prononce le nom des lettres.
LETTER_NAMES = {
    "ا": "الف", "ل": "لام", "م": "ميم", "ص": "صاد", "ر": "را", "ك": "كاف",
    "ه": "ها", "ي": "يا", "ع": "عين", "ط": "طا", "س": "سين", "ح": "حا",
    "ق": "قاف", "ن": "نون",
}
MUQATTAAT_VERSES = {
    (2, 1), (3, 1), (7, 1), (10, 1), (11, 1), (12, 1), (13, 1), (14, 1), (15, 1),
    (19, 1), (20, 1), (26, 1), (27, 1), (28, 1), (29, 1), (30, 1), (31, 1), (32, 1),
    (36, 1), (38, 1), (40, 1), (41, 1), (42, 1), (42, 2), (43, 1), (44, 1), (45, 1),
    (46, 1), (50, 1), (68, 1),
}


def skeleton(word: str) -> str:
    """Même normalisation que src/lib/arabic.ts (à garder synchronisé)."""
    w = word.replace("ٰ", "ا")  # alif suscrit -> alif
    w = DIAC_RE.sub("", w)
    w = re.sub("[أإآٱ]", "ا", w)
    w = w.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    w = w.replace("ء", "")
    w = re.sub(r"[^ء-ي]", "", w)
    w = re.sub(r"اا+", "ا", w)
    return w


def skeleton_no_dagger(word: str) -> str:
    return skeleton(word.replace("ٰ", ""))


def lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def sim(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    return 1 - lev(a, b) / max(len(a), len(b))


def align(uth: list[str], clean: list[str]) -> list[str]:
    """Associe chaque mot uthmani à son équivalent en orthographe moderne
    (1 mot uthmani <-> 1 ou 2 mots modernes, ex. يَـٰٓأَيُّهَا <-> يا أيها)."""
    n, m = len(uth), len(clean)
    INF = float("inf")
    cost = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0
    us = [skeleton(w) for w in uth]
    cs = [skeleton(w) for w in clean]
    for i in range(n + 1):
        for j in range(m + 1):
            c = cost[i][j]
            if c == INF:
                continue
            if i < n and j < m:
                v = c + (1 - sim(us[i], cs[j]))
                if v < cost[i + 1][j + 1]:
                    cost[i + 1][j + 1], back[i + 1][j + 1] = v, (i, j, 1)
            if i < n and j + 1 < m:
                v = c + (1 - sim(us[i], cs[j] + cs[j + 1])) + 0.05
                if v < cost[i + 1][j + 2]:
                    cost[i + 1][j + 2], back[i + 1][j + 2] = v, (i, j, 2)
    out = [""] * n
    i, j = n, m
    while i > 0:
        pi, pj, k = back[i][j]
        out[pi] = "".join(cs[pj:pj + k])
        i, j = pi, pj
    return out


def load(path: Path) -> dict:
    d = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        s, a, t = line.split("|", 2)
        d[(int(s), int(a))] = t
    return d


def tokens(text: str) -> list[tuple[str, str]]:
    """Découpe en (mot, signes de pause attachés)."""
    out: list[list[str]] = []
    for tok in text.split():
        if MARK_RE.match(tok) and out:
            out[-1][1] += tok
        elif MARK_RE.match(tok):
            continue
        else:
            out.append([tok, ""])
    return [(w, m) for w, m in out]


def main(src: Path, dst: Path) -> None:
    uth = load(src / "quran-uthmani.txt")
    clean = load(src / "quran-simple-clean.txt")
    meta_js = (src / "quran-data.js").read_text(encoding="utf-8")
    block = meta_js.split("QuranData.Sura = [", 1)[1].split("];", 1)[0]
    rows = re.findall(r"\[(\d+), (\d+), (\d+), (\d+), '([^']+)', \"([^\"]+)\", '([^']+)', '(\w+)'\]", block)
    assert len(rows) == 114, len(rows)

    basmala = [w for w, _ in tokens(uth[(1, 1)])]
    surahs = []
    for idx, (_, ayas, _, _, name, tname, ename, typ) in enumerate(rows, 1):
        ayahs = []
        for a in range(1, int(ayas) + 1):
            ut = tokens(uth[(idx, a)])
            cl = [w for w, _ in tokens(clean[(idx, a)])]
            if a == 1 and idx not in (1, 9) and [skeleton(w) for w, _ in ut[:4]] == [skeleton(w) for w in basmala]:
                ut, cl = ut[4:], cl[4:]
            mapped = align([w for w, _ in ut], cl)
            words = []
            for wi, ((w, mark), modern) in enumerate(zip(ut, mapped)):
                variants = {skeleton(w), skeleton_no_dagger(w), modern}
                if (idx, a) in MUQATTAAT_VERSES and wi == 0:
                    letters = skeleton_no_dagger(w)
                    variants.add("".join(LETTER_NAMES.get(ch, ch) for ch in letters))
                variants.discard("")
                entry = {"t": w, "k": sorted(variants)}
                if mark:
                    entry["m"] = mark
                words.append(entry)
            ayahs.append(words)
        surahs.append({"n": idx, "name": name, "tname": tname, "ename": ename,
                       "type": typ, "ayahs": ayahs})

    out = {
        "source": "Tanzil Quran Text (Uthmani), tanzil.net — licence CC BY 3.0, texte non modifié",
        "basmala": basmala,
        "surahs": surahs,
    }
    dst.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(len(s["ayahs"]) for s in surahs)
    print(f"{dst}: {total} versets, {dst.stat().st_size/1e6:.1f} Mo")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
