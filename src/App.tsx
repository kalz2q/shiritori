import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const NO_MATCH = "該当する言葉がありません";

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

export default function App() {
  const [input, setInput] = useState("");
  const [memos, setMemos] = useState<string[]>([]);
  const [butaWords, setButaWords] = useState<string[]>([]);
  const [lastComputerWord, setLastComputerWord] = useState("");
  const [dictionaryStatus, setDictionaryStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/buta_words.txt`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("豚辞書を読み込めませんでした");
        }
        return response.text();
      })
      .then((text) => {
        const words = text
          .split(/\r?\n/)
          .map((word) => word.trim())
          .filter(Boolean);

        setButaWords(words);
        setDictionaryStatus("ready");
      })
      .catch((error) => {
        console.error(error);
        setDictionaryStatus("error");
      });
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const isBlank = input.trim() === "";
    const hasKanji = /\p{Script=Han}/u.test(input);

    const baseWord = isBlank || hasKanji ? lastComputerWord : input;

    const normalizedInput = komojiFree(katakanaToHiragana(baseWord));

    const selectedDictionary = butaWords.filter((word) =>
      word.startsWith(lastChar(normalizedInput)),
    );

    const randomIndex = Math.floor(Math.random() * selectedDictionary.length);

    const computerAnswer = selectedDictionary[randomIndex] ?? NO_MATCH;

    setMemos((previous) => [
      ...previous,
      ...(isBlank ? [] : [input]),
      computerAnswer,
    ]);

    if (computerAnswer !== NO_MATCH) {
      setLastComputerWord(computerAnswer);
    }

    setInput("");
  };

  const googleSearchUrl = (word: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(word)}`;

  return (
    <div className="shiritori-app">
      <section className="introduction">
        <p>
          暇つぶし・アイデア出しのためのしりとりゲームです。
          入力チェックはしません。 入力なしでもEnterを押すと先へ進みます。
          「ん」で終わっても大丈夫です。 促音「つ」で終わっても大丈夫です。
          意外な単語の組み合わせで想像を膨らましてください。
          豚辞書14版を使いました。
          「意味を調べる」ボタンはGoogle検索です。ひらがなで入力してください
        </p>
      </section>

      {dictionaryStatus === "loading" && <p>豚辞書を読み込んでいます...</p>}

      {dictionaryStatus === "error" && <p>豚辞書を読み込めませんでした。</p>}

      <form className="game-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={dictionaryStatus !== "ready"}
        />

        <button type="submit" disabled={dictionaryStatus !== "ready"}>
          Enter
        </button>
      </form>

      <ul className="history-list">
        {memos.map((memo, index) => (
          <li key={index}>
            <span>{memo}</span>

            {memo !== NO_MATCH && (
              <a
                className="meaning-button"
                href={googleSearchUrl(memo)}
                target="_blank"
                rel="noopener noreferrer"
              >
                意味を調べる
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
