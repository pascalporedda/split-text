export type SplitTextDelimiter =
  | "word"
  | "character"
  | "letter"
  | "char"
  | "all"
  | "sentence"
  | "element"
  | RegExp;

export const DEFAULT_CLASS_NAME = "splitted-text-element";

export interface SplitTextOptions {
  delimiter: SplitTextDelimiter;
  tag: string;
  customClass: string;
  generateIndexId: boolean;
  generateValueClass: boolean;
  stripHTMLTags: boolean;
  aria: boolean;
  debug: boolean;
}

export interface TraverseRuntimeConfig {
  index: number;
  wrappers: Node[];
  nodeBeginning: boolean;
  delimiterRegex: RegExp;
}

const defaults: SplitTextOptions = {
  delimiter: "word",
  tag: "span",
  customClass: "",
  generateIndexId: false,
  generateValueClass: false,
  stripHTMLTags: false,
  aria: true,
  debug: false,
};

const charRanges = {
  latinPunctuation: "–—′’'“″„\"(«.…¡¿′’'”″“\")».…!?",
  latinLetters:
  "\\u0041-\\u005A\\u0061-\\u007A\\u00C0-\\u017F\\u0100-\\u01FF\\u0180-\\u027F",
};

const regExes = {
  abbreviations: new RegExp(
    "[^" +
    charRanges.latinLetters +
    "](e\\.g\\.)|(i\\.e\\.)|(mr\\.)|(mrs\\.)|(ms\\.)|(dr\\.)|(prof\\.)|(esq\\.)|(sr\\.)|(jr\\.)[^" +
    charRanges.latinLetters +
    "]",
    "ig"
  ),
  innerWordPeriod: new RegExp(
    "[" + charRanges.latinLetters + "].[" + charRanges.latinLetters + "]",
    "ig"
  ),
  onlyContainsPunctuation: new RegExp("[^" + charRanges.latinPunctuation + "]"),
  adjoinedPunctuation: new RegExp(
    "^[" +
    charRanges.latinPunctuation +
    "]+|[" +
    charRanges.latinPunctuation +
    "]+$",
    "g"
  ),
  hasPluginClass: new RegExp("(^| )" + DEFAULT_CLASS_NAME + "( |$)", "gi"),
  skippedElements: /(script|style|select|textarea)/i,
  hasClass: new RegExp("(^| )" + DEFAULT_CLASS_NAME + "( |$)", "gi"),
};

const encodePunctuation = (text: string) => {
  return (
    text
    /* Escape the following Latin abbreviations and English titles: e.g., i.e., Mr., Mrs., Ms., Dr., Prof., Esq., Sr., and Jr. */
    .replace(regExes.abbreviations, (match) => match.replace(/\./g, "{{46}}"))
    .replace(regExes.innerWordPeriod, (match) =>
      match.replace(/\./g, "{{46}}")
    )
  );
};

const decodePunctuation = (text: string) =>
  text.replace(/{{(\d{1,3})}}/g, (_fullMatch, subMatch) =>
    String.fromCharCode(subMatch)
  );

const buildDelimiterRegex = (delimiterType: SplitTextDelimiter): RegExp => {
  switch (delimiterType) {
    case "all":
      /* Matches every character then later sets spaces to "white-space: pre-line" so they don't collapse. */
      return /(.)/;

    case "letter":
    case "char":
    case "character":
      /* Matches every non-space character. */
      /* Note: This is the slowest delimiter. However, its slowness is only noticeable when it's used on larger bodies of text (of over 500 characters).  */
      return /(\S)/;

    case "word":
      /* Matches strings in between space characters. */
      /* Note: Matches will include any punctuation that's adjoined to the word, e.g. "Hey!" will be a full match. */
      /* Note: Remember that, with splittext, every HTML element marks the start of a brand new string. Hence, "in<b>si</b>de" matches as three separate words. */
      return /\s*(\S+)\s*/;

    case "sentence":
      /* Matches phrases either ending in Latin alphabet punctuation or located at the end of the text. (Linebreaks are not considered punctuation.) */
      /* Note: If you don't want punctuation to demarcate a sentence match, replace the punctuation character with {{ASCII_CODE_FOR_DESIRED_PUNCTUATION}}. ASCII codes: .={{46}}, ?={{63}}, !={{33}} */
      return /(?=\S)(([.]{2,})?[^!?]+?([.…!?]+|(?=\s+$)|$)(\s*[′’'”″“")»]+)*)/;
      /* RegExp explanation (Tip: Use Regex101.com to play around with this expression and see which strings it matches):
                   - Expanded view: /(?=\S) ( ([.]{2,})? [^!?]+? ([.…!?]+|(?=\s+$)|$) (\s*[′’'”″“")»]+)* )
                   - (?=\S) --> Match must contain a non-space character.
                   - ([.]{2,})? --> Match may begin with a group of periods.
                   - [^!?]+? --> Grab everything that isn't an unequivocally-terminating punctuation character, but stop at the following condition...
                   - ([.…!?]+|(?=\s+$)|$) --> Match the last occurrence of sentence-final punctuation or the end of the text (optionally with left-side trailing spaces).
                   - (\s*[′’'”″“")»]+)* --> After the final punctuation, match any and all pairs of (optionally space-delimited) quotes and parentheses.
       */

    case "element":
      /* Matches text between HTML tags. */
      return /(?=\S)([\S\s]*\S)/;

    default:
      if (delimiterType instanceof RegExp) {
        return delimiterType;
      } else {
        console.log(
          DEFAULT_CLASS_NAME +
          ": Unrecognized delimiter, empty search string, or invalid custom Regex. Defaulting to word regex."
        );

        // Defaulting to the word regex
        return /\s*(\S+)\s*/;
      }
  }
};

const wrapNode = (node: Text, opts: SplitTextOptions, index: number) => {
  var wrapper = document.createElement(opts.tag);

  wrapper.className = DEFAULT_CLASS_NAME;

  /* If a custom class was provided, assign that too. */
  if (opts.customClass) {
    wrapper.className += " " + opts.customClass;

    /* If an opts.customClass is provided, generate an ID consisting of customClass and a number indicating the match's iteration. */
    if (opts.generateIndexId) {
      wrapper.id = opts.customClass + "-" + index;
    }
  }

  /* For the "all" delimiter, prevent space characters from collapsing. */
  if (opts.delimiter === "all" && /\s/.test(node.data)) {
    wrapper.style.whiteSpace = "pre-line";
  }

  /* Assign the element a class equal to its escaped inner text. Only applicable to the character and word delimiters (since they do not contain spaces). */
  if (
    opts.generateValueClass === true &&
    (opts.delimiter === "character" || opts.delimiter === "word")
  ) {
    let text = node.data + '';

    /* For the word delimiter, remove adjoined punctuation, which is unlikely to be desired as part of the match -- unless the text
                consists solely of punctuation (e.g. "!!!"), in which case we leave the text as-is. */
    if (opts.delimiter === "word" && regExes.onlyContainsPunctuation.test(text)) {
      /* E: Remove punctuation that's adjoined to either side of the word match. */
      text = text.replace(regExes.adjoinedPunctuation, "");
    }

    const valueClass =
      DEFAULT_CLASS_NAME + "-" + opts.delimiter.toLowerCase() + "-" + text.toLowerCase();

    wrapper.className += " " + valueClass;
  }

  /* Hide the wrapper elements from screenreaders now that we've set the target's aria-label attribute. */
  if (opts.aria) {
    wrapper.setAttribute("aria-hidden", "true");
  }

  wrapper.appendChild(node.cloneNode(false));

  return wrapper;
};

const traverseDOM = (
  node: Node,
  opts: SplitTextOptions,
  runtimeConfig: TraverseRuntimeConfig
) => {
  let matchPosition = -1;
  let skipNodeBit = 0;

  /* Only proceed if the node is a text node and isn't empty. */
  if (node.nodeType === 3) {
    const textNode: Text = node as Text;
    /* Perform punctuation encoding/decoding once per original whole text node (before it gets split up into bits). */
    if (runtimeConfig.nodeBeginning) {
      /* For the sentence delimiter, we first escape likely false-positive sentence-final punctuation. For all other delimiters,
                     we must decode the user's manually-escaped punctuation so that the RegEx can match correctly (without being thrown off by characters in {{ASCII}}). */
      textNode.data =
        opts.delimiter === "sentence"
        ? encodePunctuation(textNode.data)
        : decodePunctuation(textNode.data);

      runtimeConfig.nodeBeginning = false;
    }

    matchPosition = textNode.data.search(runtimeConfig.delimiterRegex);

    /* If there's a RegEx match in this text node, proceed with element wrapping. */
    if (matchPosition !== -1) {
      const match = textNode.data.match(runtimeConfig.delimiterRegex);
      if (match !== null) {
        let matchText = match[0];
        const subMatchText = match[1] || false;

        /* RegEx queries that can return empty strings (e.g ".*") produce an empty matchText which throws the entire traversal process into an infinite loop due to the position index not incrementing.
                     Thus, we bump up the position index manually, resulting in a zero-width split at this location followed by the continuation of the traversal process. */
        if (matchText === "") {
          matchPosition++;
          /* If a RegEx submatch is produced that is not identical to the full string match, use the submatch's index position and text.
                     This technique allows us to avoid writing multi-part RegEx queries for submatch finding. */
        } else if (subMatchText && subMatchText !== matchText) {
          matchPosition += matchText.indexOf(subMatchText);
          matchText = subMatchText;
        }

        /* Split this text node into two separate nodes at the position of the match, returning the node that begins after the match position. */
        const middleBit = textNode.splitText(matchPosition);

        /* Split the newly-produced text node at the end of the match's text so that middleBit is a text node that consists solely of the matched text. The other newly-created text node, which begins
                     at the end of the match's text, is what will be traversed in the subsequent loop (in order to find additional matches in the containing text node). */
        middleBit.splitText(matchText.length);

        /* Over-increment the loop counter (see below) so that we skip the extra node (middleBit) that we've just created (and already processed). */
        skipNodeBit = 1;

        if (opts.delimiter === "sentence") {
          /* Now that we've forcefully escaped all likely false-positive sentence-final punctuation, we must decode the punctuation back from ASCII. */
          middleBit.data = decodePunctuation(middleBit.data);
        }

        /* Create the wrapped node. */
        var wrappedNode = wrapNode(middleBit, opts, runtimeConfig.index);
        /* Then replace the middleBit text node with its wrapped version. */
        middleBit.parentNode?.replaceChild(wrappedNode, middleBit);

        /* Push the wrapper onto the Element.wrappers array (for later use with stack manipulation). */
        runtimeConfig.wrappers.push(wrappedNode);

        runtimeConfig.index++;

        /* Note: We use this slow splice-then-iterate method because every match needs to be converted into an HTML element node. A text node's text cannot have HTML elements inserted into it. */
        /* TODO: To improve performance, use documentFragments to delay node manipulation so that DOM queries and updates can be batched across elements. */
      }
    }
/* Traverse the DOM tree until we find text nodes. Skip script and style elements. Skip select and textarea elements since they contain special text nodes that users would not want wrapped.
             Additionally, check for the existence of our plugin's class to ensure that we do not retraverse elements that have already been splitted. */
/* Note: This basic DOM traversal technique is copyright Johann Burkard <http://johannburkard.de>. Licensed under the MIT License: http://en.wikipedia.org/wiki/MIT_License */
  } else if (node.nodeType === 1 && node.hasChildNodes()) {
    const element = node as Element;
    if (
      !regExes.skippedElements.test(element.tagName) &&
      !regExes.hasPluginClass.test(element.className)
    ) {
      /* Note: We don't cache childNodes' length since it's a live nodeList (which changes dynamically with the use of splitText() above). */
      for (let i = 0; i < node.childNodes.length; i++) {
        runtimeConfig.nodeBeginning = true;

        i += traverseDOM(node.childNodes[i], opts, runtimeConfig);
      }
    }
  }

  return skipNodeBit;
};

const SplitText = (element: HTMLElement, options: SplitTextOptions) => {
  const opts: SplitTextOptions = { ...defaults, ...options };
  const delimiterRegex = buildDelimiterRegex(opts.delimiter);

  const text = element.textContent ?? '';

  try {
    document.createElement(opts.tag);
  } catch (error) {
    opts.tag = "span";

    if (opts.debug)
      console.log(
        DEFAULT_CLASS_NAME + ": Invalid tag supplied. Defaulting to span."
      );
  }

  if (opts.stripHTMLTags) {
    element.innerHTML = text;
  }

  if (opts.aria) {
    element.setAttribute("aria-label", text);
  }

  element.classList.add(DEFAULT_CLASS_NAME + "-root");

  const traverseRuntimeConfig: TraverseRuntimeConfig = {
    index: 0,
    nodeBeginning: false,
    wrappers: [],
    delimiterRegex,
  };

  /* Initiate the DOM traversal process. */
  if (opts.debug) console.time(DEFAULT_CLASS_NAME);
  traverseDOM(element, opts, traverseRuntimeConfig);
  if (opts.debug) console.timeEnd(DEFAULT_CLASS_NAME);
};

export default SplitText;
