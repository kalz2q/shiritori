import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const NO_MATCH = "該当する言葉がありません";

type Word = {
  reading: string;
  title: string;
};

type DictionaryFile = {
  file: string;
  count: number;
};

type DictionaryManifest = {
  files: Record<string, DictionaryFile>;
};

type HistoryItem = {
  reading: string;
  title?: string;
};

function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function komojiFree(str: string): string {
  return str
    .replace(/ぁ/g, "あ")
    .replace(/ぃ/g, "い")
    .replace(/ぅ/g, "う")
    .replace(/ぇ/g, "え")
    .replace(/ぉ/g, "お")
    .replace(/ゃ/g, "や")
    .replace(/ゅ/g, "ゆ")
    .replace(/ょ/g, "よ")
    .replace(/っ/g, "つ")
    .replace(/ゎ/g, "わ");
}

function lastChar(input: string): string {
  const chars = input.split("");
  let char = chars.pop();

  while (char === "ー" || char === "ん") {
    char = chars.pop();
  }

  return char ?? "";
}

function chooseRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export default function App() {
  const [input, setInput] = useState("");
  const [memos, setMemos] = useState<HistoryItem[]>([]);
  const [lastComputerWord, setLastComputerWord] = useState("");
  const [manifest, setManifest] = useState<DictionaryManifest | null>(null);
  const [dictionaryStatus, setDictionaryStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [isSearching, setIsSearching] = useState(false);
  const [loadError, setLoadError] = useState("");

  // 一度取得した先頭文字別ファイルは、ページを開いている間メモリに保持する。
  const wordCache = useRef<Map<string, Word[]>>(new Map());

  useEffect(() => {
    let cancelled = false;

    fetch(`${import.meta.env.BASE_URL}shiritori_wiki/manifest.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Wikipedia辞書の目録を読み込めませんでした");
        }
        return response.json() as Promise<DictionaryManifest>;
      })
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
        setDictionaryStatus("ready");
      })
      .catch((error: unknown) => {
        console.error(error);
        if (cancelled) return;
        setDictionaryStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadWordsForFirstChar = async (
    firstChar: string,
    dictionaryManifest: DictionaryManifest,
  ): Promise<Word[]> => {
    const cached = wordCache.current.get(firstChar);
    if (cached) {
      // 直近8グループだけを保持し、長時間の利用でメモリが膨らみすぎないようにする。
      wordCache.current.delete(firstChar);
      wordCache.current.set(firstChar, cached);
      return cached;
    }

    const fileInfo = dictionaryManifest.files[firstChar];
    if (!fileInfo) return [];

    const response = await fetch(
      `${import.meta.env.BASE_URL}shiritori_wiki/${fileInfo.file}`,
    );
    if (!response.ok) {
      throw new Error(`辞書ファイルを読み込めません: ${fileInfo.file}`);
    }

    const words = (await response.json()) as Word[];
    if (!Array.isArray(words)) {
      throw new Error(`辞書ファイルの形式が不正です: ${fileInfo.file}`);
    }

    wordCache.current.set(firstChar, words);
    while (wordCache.current.size > 8) {
      const oldestKey = wordCache.current.keys().next().value;
      if (oldestKey === undefined) break;
      wordCache.current.delete(oldestKey);
    }
    return words;
  };

  // 最初の一手など、接続する文字が決まっていない場合は、
  // 単語数に比例した重みで先頭文字グループを選び、全体から均等に1語を選ぶ。
  const loadRandomStartingGroup = async (
    dictionaryManifest: DictionaryManifest,
  ): Promise<Word[]> => {
    const groups = Object.entries(dictionaryManifest.files).filter(
      ([firstChar, info]) => firstChar !== "ん" && info.count > 0,
    );

    const total = groups.reduce((sum, [, info]) => sum + info.count, 0);
    if (total === 0) return [];

    let target = Math.floor(Math.random() * total);
    for (const [firstChar, info] of groups) {
      if (target < info.count) {
        return loadWordsForFirstChar(firstChar, dictionaryManifest);
      }
      target -= info.count;
    }

    return [];
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!manifest || isSearching) return;

    const submittedInput = input;
    const isBlank = submittedInput.trim() === "";
    const hasKanji = /\p{Script=Han}/u.test(submittedInput);
    const baseWord = isBlank || hasKanji ? lastComputerWord : submittedInput;
    const normalizedInput = komojiFree(katakanaToHiragana(baseWord));
    const requiredFirstChar = lastChar(normalizedInput);

    setIsSearching(true);
    setLoadError("");

    try {
      const candidates = requiredFirstChar
        ? await loadWordsForFirstChar(requiredFirstChar, manifest)
        : await loadRandomStartingGroup(manifest);

      const computerAnswer = chooseRandom(candidates);

      setMemos((previous) => [
        ...previous,
        ...(isBlank ? [] : [{ reading: submittedInput }]),
        computerAnswer
          ? {
              reading: computerAnswer.reading,
              title: computerAnswer.title,
            }
          : { reading: NO_MATCH },
      ]);

      if (computerAnswer) {
        setLastComputerWord(computerAnswer.reading);
      }

      setInput("");
    } catch (error) {
      console.error(error);
      setLoadError(
        "辞書ファイルを読み込めませんでした。辞書データの配置を確認してください。",
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="shiritori-app">
      <section className="introduction">
        <p>
          暇つぶし・アイデア出しのためのしりとりゲームです。
          入力チェックはしません。入力なしでもEnterを押すと先へ進みます。
          「ん」で終わっても大丈夫です。促音「つ」で終わっても大丈夫です。
          意外な単語の組み合わせで想像を膨らましてください。
          Wikipedia日本語版の記事見出しをもとにした辞書を使っています。
          ひらがなで入力してください。
        </p>
      </section>

      {dictionaryStatus === "loading" && (
        <p>Wikipedia辞書の目録を読み込んでいます...</p>
      )}
      {dictionaryStatus === "error" && (
        <p>Wikipedia辞書を読み込めませんでした。</p>
      )}
      {loadError && <p role="alert">{loadError}</p>}

      <form className="game-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={dictionaryStatus !== "ready" || isSearching}
        />
        <button
          type="submit"
          disabled={dictionaryStatus !== "ready" || isSearching}
        >
          {isSearching ? "検索中..." : "Enter"}
        </button>
      </form>

      <ul className="history-list" aria-live="polite">
        {memos.map((memo, index) => (
          <li key={index}>
            <span>{memo.reading}</span>
            {memo.title && memo.title !== memo.reading && (
              <span className="dictionary-title">{memo.title}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
