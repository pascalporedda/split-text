export declare type SplitTextDelimiter = "word" | "character" | "letter" | "char" | "all" | "sentence" | "element" | RegExp;
export declare const DEFAULT_CLASS_NAME = "splitted-text-element";
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
declare const SplitText: (element: HTMLElement, options: SplitTextOptions) => void;
export default SplitText;
