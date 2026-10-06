/* =========================================================
   I18N — the interface in English on demand.
   The game's strings are written in Hebrew; in English mode every piece of text that
   reaches the page (and the card labels drawn on canvas) is translated as it appears,
   so the same rules engine runs untouched in either language.
   ========================================================= */
let LANG = (ls('silang')==='en') ? 'en' : 'he';
const HEB_RE=/[\u0590-\u05FF]/;
/* labels that read differently as a button than inside a sentence */
const I18N_ONLY_EXACT={'מסכים':'Accept','מסכימה':'Accept','מסכים/ה':'Accept',
  'לא מעוניין':'Not interested','לא מעוניינת':'Not interested','לא מעוניין/ת':'Not interested'};
/* very short words that may be replaced inside a sentence, but only as whole words */
const I18N_WORDS=['עץ','צמר','אבן','בד','יער','לבן','חום','מדע','נפח','עיר','דרך','כוח','קשה'];
const DEFAULT_NAMES_EN=['Roy','Computer','Itai','Jonathan','Maya','Omer'];
