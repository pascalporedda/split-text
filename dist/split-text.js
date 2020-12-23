"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CLASS_NAME = void 0;
exports.DEFAULT_CLASS_NAME = "splitted-text-element";
var defaults = {
    delimiter: "word",
    tag: "span",
    customClass: "",
    generateIndexId: false,
    generateValueClass: false,
    stripHTMLTags: false,
    aria: true,
    debug: false,
};
var charRanges = {
    latinPunctuation: "–—′’'“″„\"(«.…¡¿′’'”″“\")».…!?",
    latinLetters: "\\u0041-\\u005A\\u0061-\\u007A\\u00C0-\\u017F\\u0100-\\u01FF\\u0180-\\u027F",
};
var regExes = {
    abbreviations: new RegExp("[^" +
        charRanges.latinLetters +
        "](e\\.g\\.)|(i\\.e\\.)|(mr\\.)|(mrs\\.)|(ms\\.)|(dr\\.)|(prof\\.)|(esq\\.)|(sr\\.)|(jr\\.)[^" +
        charRanges.latinLetters +
        "]", "ig"),
    innerWordPeriod: new RegExp("[" + charRanges.latinLetters + "].[" + charRanges.latinLetters + "]", "ig"),
    onlyContainsPunctuation: new RegExp("[^" + charRanges.latinPunctuation + "]"),
    adjoinedPunctuation: new RegExp("^[" +
        charRanges.latinPunctuation +
        "]+|[" +
        charRanges.latinPunctuation +
        "]+$", "g"),
    hasPluginClass: new RegExp("(^| )" + exports.DEFAULT_CLASS_NAME + "( |$)", "gi"),
    skippedElements: /(script|style|select|textarea)/i,
    hasClass: new RegExp("(^| )" + exports.DEFAULT_CLASS_NAME + "( |$)", "gi"),
};
var encodePunctuation = function (text) {
    return (text
        .replace(regExes.abbreviations, function (match) { return match.replace(/\./g, "{{46}}"); })
        .replace(regExes.innerWordPeriod, function (match) {
        return match.replace(/\./g, "{{46}}");
    }));
};
var decodePunctuation = function (text) {
    return text.replace(/{{(\d{1,3})}}/g, function (_fullMatch, subMatch) {
        return String.fromCharCode(subMatch);
    });
};
var buildDelimiterRegex = function (delimiterType) {
    switch (delimiterType) {
        case "all":
            return /(.)/;
        case "letter":
        case "char":
        case "character":
            return /(\S)/;
        case "word":
            return /\s*(\S+)\s*/;
        case "sentence":
            return /(?=\S)(([.]{2,})?[^!?]+?([.…!?]+|(?=\s+$)|$)(\s*[′’'”″“")»]+)*)/;
        case "element":
            return /(?=\S)([\S\s]*\S)/;
        default:
            if (delimiterType instanceof RegExp) {
                return delimiterType;
            }
            else {
                console.log(exports.DEFAULT_CLASS_NAME +
                    ": Unrecognized delimiter, empty search string, or invalid custom Regex. Defaulting to word regex.");
                return /\s*(\S+)\s*/;
            }
    }
};
var wrapNode = function (node, opts, index) {
    var wrapper = document.createElement(opts.tag);
    wrapper.className = exports.DEFAULT_CLASS_NAME;
    if (opts.customClass) {
        wrapper.className += " " + opts.customClass;
        if (opts.generateIndexId) {
            wrapper.id = opts.customClass + "-" + index;
        }
    }
    if (opts.delimiter === "all" && /\s/.test(node.data)) {
        wrapper.style.whiteSpace = "pre-line";
    }
    if (opts.generateValueClass === true &&
        (opts.delimiter === "character" || opts.delimiter === "word")) {
        var text = node.data + '';
        if (opts.delimiter === "word" && regExes.onlyContainsPunctuation.test(text)) {
            text = text.replace(regExes.adjoinedPunctuation, "");
        }
        var valueClass = exports.DEFAULT_CLASS_NAME + "-" + opts.delimiter.toLowerCase() + "-" + text.toLowerCase();
        wrapper.className += " " + valueClass;
    }
    if (opts.aria) {
        wrapper.setAttribute("aria-hidden", "true");
    }
    wrapper.appendChild(node.cloneNode(false));
    return wrapper;
};
var traverseDOM = function (node, opts, runtimeConfig) {
    var _a;
    var matchPosition = -1;
    var skipNodeBit = 0;
    if (node.nodeType === 3) {
        var textNode = node;
        if (runtimeConfig.nodeBeginning) {
            textNode.data =
                opts.delimiter === "sentence"
                    ? encodePunctuation(textNode.data)
                    : decodePunctuation(textNode.data);
            runtimeConfig.nodeBeginning = false;
        }
        matchPosition = textNode.data.search(runtimeConfig.delimiterRegex);
        if (matchPosition !== -1) {
            var match = textNode.data.match(runtimeConfig.delimiterRegex);
            if (match !== null) {
                var matchText = match[0];
                var subMatchText = match[1] || false;
                if (matchText === "") {
                    matchPosition++;
                }
                else if (subMatchText && subMatchText !== matchText) {
                    matchPosition += matchText.indexOf(subMatchText);
                    matchText = subMatchText;
                }
                var middleBit = textNode.splitText(matchPosition);
                middleBit.splitText(matchText.length);
                skipNodeBit = 1;
                if (opts.delimiter === "sentence") {
                    middleBit.data = decodePunctuation(middleBit.data);
                }
                var wrappedNode = wrapNode(middleBit, opts, runtimeConfig.index);
                (_a = middleBit.parentNode) === null || _a === void 0 ? void 0 : _a.replaceChild(wrappedNode, middleBit);
                runtimeConfig.wrappers.push(wrappedNode);
                runtimeConfig.index++;
            }
        }
    }
    else if (node.nodeType === 1 && node.hasChildNodes()) {
        var element = node;
        if (!regExes.skippedElements.test(element.tagName) &&
            !regExes.hasPluginClass.test(element.className)) {
            for (var i = 0; i < node.childNodes.length; i++) {
                runtimeConfig.nodeBeginning = true;
                i += traverseDOM(node.childNodes[i], opts, runtimeConfig);
            }
        }
    }
    return skipNodeBit;
};
var SplitText = function (element, options) {
    var _a;
    var opts = __assign(__assign({}, defaults), options);
    var delimiterRegex = buildDelimiterRegex(opts.delimiter);
    var text = (_a = element.textContent) !== null && _a !== void 0 ? _a : '';
    try {
        document.createElement(opts.tag);
    }
    catch (error) {
        opts.tag = "span";
        if (opts.debug)
            console.log(exports.DEFAULT_CLASS_NAME + ": Invalid tag supplied. Defaulting to span.");
    }
    if (opts.stripHTMLTags) {
        element.innerHTML = text;
    }
    if (opts.aria) {
        element.setAttribute("aria-label", text);
    }
    element.classList.add(exports.DEFAULT_CLASS_NAME + "-root");
    var traverseRuntimeConfig = {
        index: 0,
        nodeBeginning: false,
        wrappers: [],
        delimiterRegex: delimiterRegex,
    };
    if (opts.debug)
        console.time(exports.DEFAULT_CLASS_NAME);
    traverseDOM(element, opts, traverseRuntimeConfig);
    if (opts.debug)
        console.timeEnd(exports.DEFAULT_CLASS_NAME);
};
exports.default = SplitText;
//# sourceMappingURL=split-text.js.map