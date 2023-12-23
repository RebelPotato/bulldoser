import remarkParse from "https://esm.sh/remark-parse@11.0.0";
import { unified } from "https://esm.sh/unified@11.0.4";
import remarkFrontmatter from "https://esm.sh/remark-frontmatter@5.0.0";
import YAML from "https://esm.sh/yaml@2.3.4";
import remarkStringify from "https://esm.sh/remark-stringify@11.0.0";
// import { visit } from "https://esm.sh/unist-util-visit@5.0.0";
import { wikiLinkPlugin } from "https://esm.sh/remark-wiki-link@2.0.1";

type FileConfig = {
  path: string;
};
const config: FileConfig = JSON.parse(await Deno.readTextFile("./config.json"));

function inbox(title: string){
  return config.path + "/inbox/" + title + ".md";
}

function archive(title: string){
  return config.path + "/archive/" + title + ".md";
}

type Tree = {
  children: Array<{
    value: string;
  }>;
};

const reader = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(wikiLinkPlugin);

type wikiLink = {
  type: "wikiLink";
  value: string;
  data: object;
};
function wikiLinkWriter(node: wikiLink): string {
  return `[[${node.value}]]`;
}

const writer = unified().use(remarkStringify, {
  handlers: {
    wikiLink: wikiLinkWriter,
  },
});

const template = `TODO
`;
const defaultTree: Tree = unified().use(remarkParse).parse(template);

class Note {
  title: string;
  staleness: number;
  review: Date;
  contents: Tree;
  constructor(
    title: string,
    contents = defaultTree,
    staleness = 0,
    review = new Date(),
  ) {
    this.title = title;
    this.staleness = staleness;
    this.review = review;
    this.contents = contents;
  }
  toYaml() {
    return YAML.stringify({
      title: this.title,
      staleness: this.staleness,
      review: this.review.toISOString(),
    });
  }
  dateString(): string{
    const now = new Date();
    const delta = now.valueOf() - this.review.valueOf()
    if(delta < 0) return Math.ceil(-delta/86400000) + "天后";
    return "现在"
  }
  postpone() {
    const d = Math.pow(2, this.staleness);
    this.staleness++;
    this.review.setTime(this.review.getTime() + d * 86400000);
    this.sync();
  }
  stringify() {
    const headerString = "---\n" + this.toYaml() + "---\n";
    return headerString + writer.stringify(this.contents);
  }
  sync() {
    Deno.writeTextFileSync(
      inbox(this.title),
      this.stringify(),
    );
  }
  rename(newTitle: string) {
    Deno.renameSync(inbox(this.title), inbox(newTitle))
    this.title = newTitle;
    this.sync();
  }
  archive() {
    Deno.renameSync(inbox(this.title), archive(this.title))
  }
}

// parses YAML header into note metadata
function toNote(value: string, contents: Tree): Note {
  const obj = YAML.parse(value);
  let time = undefined;
  if (obj.review != undefined) time = new Date(obj.review);
  return new Note(obj.title, contents, obj.staleness, time);
}

function readNote(entry: Deno.DirEntry) {
  if (!entry.isFile) return;
  const tree: Tree = reader.parse(
    Deno.readTextFileSync(config.path + "/inbox/" + entry.name),
  );
  const val = tree.children[0].value;
  tree.children.shift();
  const note = toNote(val, tree);
  return note;
}

// 
class Notebook {
  contents: Map<string, Note>
  constructor() {
    this.contents = new Map();
    for (const entry of Deno.readDirSync(config.path + "/inbox")){
      const n = readNote(entry);
      if (n != undefined) this.contents.set(n.title, n);
    }
  }
  all() {
    const arr = []
    for (const note of this.contents.values()) arr.push(note);
    return arr.sort((a,b) => a.review.valueOf()-b.review.valueOf())
  }
  has(title: string) {
    return this.contents.has(title);
  }
  get(title: string) {
    return this.contents.get(title);
  }
  add(n: Note) {
    this.contents.set(n.title, n);
    n.sync();
  }
  rename(title: string, newTitle: string) {
    const n = this.contents.get(title);
    if (n == undefined) return;
    n.rename(newTitle);
    this.contents.set(newTitle, n);
    this.contents.delete(title);
  }
  archive(title: string) {
    const n = this.contents.get(title);
    if (n == undefined) return;
    n.archive();
    this.contents.delete(title);
  }
}

export { Notebook,  Note };
