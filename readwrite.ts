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
  }
  stringify() {
    const headerString = "---\n" + this.toYaml() + "---\n";
    return headerString + writer.stringify(this.contents);
  }
}

// parses YAML header into note metadata
function toNote(value: string, contents: Tree): Note {
  const obj = YAML.parse(value);
  let time = undefined;
  if (obj.review != undefined) time = new Date(obj.review);
  return new Note(obj.title, contents, obj.staleness, time);
}

async function readNote(entry: Deno.DirEntry) {
  if (!entry.isFile) return;
  const tree: Tree = reader.parse(
    await Deno.readTextFile(config.path + "/inbox/" + entry.name),
  );
  const val = tree.children[0].value;
  tree.children.shift();
  const note = toNote(val, tree);
  return note;
}

type InboxResult = "ok" | { error: string }

async function writeInbox(note: Note): Promise<InboxResult> {
  await Deno.writeTextFile(
    config.path + "/inbox/" + note.title + ".md",
    note.stringify(),
  );
  return "ok";
}

async function renameInbox(oldTitle: string, note: Note): Promise<InboxResult> {
  // console.log(`Renameing ${oldTitle}.md to ${note.title}.md`)
  await writeInbox(note);
  await Deno.remove(config.path + "/inbox/" + oldTitle + ".md");
  return "ok";
}

async function readNotes(): Promise<Note[]> {
  const notes: Note[] = [];
  for await (const entry of Deno.readDir(config.path + "/inbox")) {
    const n = await readNote(entry);
    if (n != undefined) notes.push(n);
  }
  notes.sort((a,b) => a.review.valueOf() - b.review.valueOf())
  return notes;
}

async function deleteInbox(note: Note) {
  await Deno.rename(config.path + "/inbox/" + note.title + ".md", config.path + "/archive/" + note.title + ".md")
}

function syncNotes(notes: Note[]) {
  // console.log("Syncing")
  notes.forEach(async n => await writeInbox(n))
  // console.log("Done")
}

// const arr = await readNotes()
// const n = arr[3]
// console.log(n.stringify())

export { writeInbox, renameInbox, deleteInbox,  Note, readNotes, syncNotes };
export type { InboxResult };
