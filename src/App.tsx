import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const aiueo =
  "あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ ー ん が ぎ ぐ げ ご ざ じ ず ぜ ぞ だ ぢ づ で ど ば び ぶ べ ぼ ぱ ぴ ぷ ぺ ぽ ぃ ぅ ぇ ぉ ゃ ゅ ょ っ ゎ".split(
    " ",
  );

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

function isValid(input: string): boolean {
  return input.split("").every((char) => aiueo.includes(char));
}

export default function App() {
  const [input, setInput] = useState("");
  const [memos, setMemos] = useState<string[]>([]);
  const [butaWords, setButaWords] = useState<string[]>([]);
  const [dictionaryStatus, setDictionaryStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  // 外部の豚辞書を読み込む
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

    if (!isValid(input)) {
      setInput("");
      return;
    }

    const normalizedInput = komojiFree(input);

    const selectedDictionary = butaWords.filter((word) =>
      word.startsWith(lastChar(normalizedInput)),
    );

    const randomIndex = Math.floor(Math.random() * selectedDictionary.length);

    const feedback = butaWords.includes(normalizedInput)
      ? ""
      : " は豚辞書にありません";

    const computerAnswer =
      selectedDictionary[randomIndex] ?? "該当する言葉がありません";

    setMemos((previous) => [
      ...previous,
      `${input}${feedback}`,
      computerAnswer,
    ]);

    setInput("");
  };

  return (
    <div style={{ textAlign: "center", width: "400px", margin: "60px auto" }}>
      <h1>しりとり</h1>

      <p>ひらかなで入力してください</p>

      {dictionaryStatus === "loading" && <p>豚辞書を読み込んでいます...</p>}

      {dictionaryStatus === "error" && <p>豚辞書を読み込めませんでした。</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ width: "70%" }}
          disabled={dictionaryStatus !== "ready"}
        />

        <button
          type="submit"
          disabled={!input.trim() || dictionaryStatus !== "ready"}
          style={{ width: "27%" }}
        >
          Submit
        </button>
      </form>

      <ul style={{ textAlign: "left" }}>
        {memos.map((memo, index) => (
          <li key={index}>{memo}</li>
        ))}
      </ul>
    </div>
  );
}
