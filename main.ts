import type { Application, Request, Response } from "https://esm.sh/express@4.18.2";
import express from "https://esm.sh/express@4.18.2";
import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import { writeInbox, renameInbox, deleteInbox, readNotes, syncNotes, Note, InboxResult } from "./readwrite.ts";

const app: Application = express();
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

const port = Number(Deno.env.get("PORT")) || 8000;

const viewpath = Deno.cwd() + "/views/";
const eta = new Eta({ views: viewpath, cache: true });

app.get("/", (_req: Request, res: Response) => {
  res.redirect("/notes");
});

app.get("/notes", async (req: Request, res: Response) => {
  const search: string = req.query.q;
  const page: number = parseInt(req.query.page) || 1;
  const notes = await readNotes();
  syncNotes(notes);

  if(search!=undefined){ 
    let temp = "index";
    if(req.get('HX-Trigger')=="search") temp = "rows";
    res.status(200).send(eta.render(temp, {
      notes: notes
        .filter(note => {
          try {
            return note.title.match(search)!=null
          } catch (_error) {
            return false
          }})
        .slice(page*10-10,page*10),
      page: page,
      search: search
    }));
    return;
  }

  res.status(200).send(eta.render("index", {
    notes: notes.slice(page*10-10,page*10),
    page: page,
    search: ""
  }));
});

type newConfig = {
  config: {
    title: string
    errors: {
      title: string
    }
  }
}

app.get("/notes/new", (req: Request, res: Response) => {
  const title: string | undefined = req.params.title;
  console.log(title);
  const defaultConfig: newConfig = {
    config: {
      title: title || "",
      errors: {
        title: ""
      }
    }
  }
  res.status(200).send(eta.render("new", defaultConfig));
});

app.post("/notes/new", async (req: Request, res: Response) => {
  const f = req.body;
  let result: InboxResult;
  const notes = await readNotes();
  if(notes.some(note => note.title == f.title)){
    result = {error: "文件已存在"}
  } else {
    result = await writeInbox(new Note(f.title));
  }

  if(result == "ok") {
    res.redirect("/notes");
  }
  else {
    const errorConfig: newConfig = {
      config: {
        title: f.title,
        errors: {
          title: result.error
        }
      }
    }
    res.status(200).send(eta.render("new", errorConfig))
  }
})

app.get("/notes/new/title", async (req: Request, res: Response) => {
  const notes = await readNotes();
  const newTitle: string = req.query.title;
  if(notes.some(note => note.title == newTitle)) {
    res.send("文件已存在")
  }
  res.send("")
})

app.get("/notes/:title", async (req: Request, res: Response) => {
  const title = req.params.title;
  const note = (await readNotes()).find(note => note.title == title);
  if(note == undefined) {
    res.redirect("/notes/new?title=" + encodeURI(title));
    return;
  }
  res.status(200).send(eta.render("show", {note: note}));
})

app.get("/notes/:title/edit", async (req: Request, res: Response) => {
  const title: string = req.params.title;
  const note = (await readNotes()).find(note => note.title == title);
  if(note == undefined) {
    res.redirect("/notes/new?title=" + title);
    return;
  }
  const editConfig: newConfig = {
    config: {
      title: title,
      errors: {
        title: ""
      }
    }
  }
  res.status(200).send(eta.render("edit", editConfig));
})

app.get("/notes/:title/title", async (req: Request, res: Response) => {
  const title: string = req.params.title;
  const notes = await readNotes();
  if(!notes.some(note => note.title == title)) {
    res.redirect("/notes/new?title=" + title);
    return;
  }
  const newTitle: string = req.query.title;
  if(notes.some(note => note.title == newTitle)) {
    res.send("文件已存在")
  }
  res.send("")
})

app.post("/notes/:title/edit", async (req: Request, res: Response) => {
  const f: {oldTitle: string, title: string} = req.body;
  let result: InboxResult;
  const notes = await readNotes();
  const note = notes.find(note => note.title == f.oldTitle);
  if(note == undefined){
    result = {error: "文件不存在"}
  } else if (notes.some((note => note.title == f.title))){
    result = {error: "新文件已存在"}
  } else {
    note.title = f.title;
    result = await renameInbox(f.oldTitle, note);
  }

  if(result == "ok") {
    res.redirect("/notes");
  }
  else {
    const errorConfig: newConfig = {
      config: {
        title: f.oldTitle,
        errors: {
          title: result.error
        }
      }
    }
    res.status(200).send(eta.render("edit", errorConfig))
  }
})

app.get("/notes/:title/postpone", async (req: Request, res: Response) => {
  const title: string = req.params.title;
  const note = (await readNotes()).find(note => note.title == title);
  if(note == undefined) {
    res.redirect("/notes/new?title=" + title);
    return;
  }
  note.postpone();
  await writeInbox(note);
  res.redirect("/notes");
})

app.delete("/notes/:title", async (req: Request, res: Response) => {
  const title: string = req.params.title;
  const note = (await readNotes()).find(note => note.title == title);
  if(note == undefined) {
    res.redirect("/notes/new?title=" + title);
    return;
  }
  await deleteInbox(note);
  if(req.get('HX-Trigger')=="delete-btn"){
    res.redirect(303, "/notes");
  } else {
    res.send("");
  }
})

app.listen(port, () => {
  console.log(`Listening on ${port} ...`);
});
