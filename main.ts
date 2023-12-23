import type { Application, Request, Response } from "https://esm.sh/express@4.18.2";
import express from "https://esm.sh/express@4.18.2";
import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import { Notebook, Note } from "./readwrite.ts";

const app: Application = express();
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

const port = Number(Deno.env.get("PORT")) || 8000;

const viewpath = Deno.cwd() + "/views/";
const eta = new Eta({ views: viewpath, cache: true });

app.get("/", (_req: Request, res: Response) => {
  res.redirect("/notes");
});

app.get("/notes", (req: Request, res: Response) => {
  const search: string = req.query.q;
  const page: number = parseInt(req.query.page) || 1;
  const notes = new Notebook();

  if(search!=undefined){ 
    let temp = "index";
    if(req.get('HX-Trigger')=="search") temp = "rows";
    res.status(200).send(eta.render(temp, {
      notes: notes.all()
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
    notes: notes.all().slice(page*10-10,page*10),
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
  const title: string | undefined = req.query.title;
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

app.post("/notes/new", (req: Request, res: Response) => {
  const f = req.body;
  let result: string | undefined;
  const notes = new Notebook();
  if(notes.has(f.title)){
    result = "文件已存在"
  } else {
    notes.add(new Note(f.title));
  }

  if(result == undefined) res.redirect("/notes");
  else {
    const errorConfig: newConfig = {
      config: {
        title: f.title,
        errors: {
          title: result
        }
      }
    }
    res.status(200).send(eta.render("new", errorConfig))
  }
})

app.get("/notes/new/title", (req: Request, res: Response) => {
  const newTitle: string = req.query.title;
  const notes = new Notebook();
  if(notes.has(newTitle)) {
    res.send("文件已存在")
  }
  res.send("")
})

app.get("/notes/:title", (req: Request, res: Response) => {
  const title = req.params.title;
  const notes = new Notebook();
  const note = notes.get(title);
  if(note == undefined) {
    res.redirect("/notes/new?title=" + encodeURI(title));
    return;
  }
  res.status(200).send(eta.render("show", {note: note}));
})

app.get("/notes/:title/edit", (req: Request, res: Response) => {
  const title: string = req.params.title;
  const notes = new Notebook();
  if(!notes.has(title)) {
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

app.get("/notes/:title/title", (req: Request, res: Response) => {
  const title: string = req.params.title;
  const notes = new Notebook
  if(!notes.has(title)) {
    res.redirect("/notes/new?title=" + title);
    return;
  }
  const newTitle: string = req.query.title;
  if(notes.has(newTitle)) {
    res.send("文件已存在")
  }
  res.send("")
})

app.post("/notes/:title/edit", (req: Request, res: Response) => {
  const f: {oldTitle: string, title: string} = req.body;
  let result: string | undefined;
  const notes = new Notebook()
  if(!notes.has(f.oldTitle)){
    result = "文件不存在"
  } else if (notes.has(f.title)){
    result = "新文件已存在"
  } else {
    notes.rename(f.oldTitle, f.title)
  }

  if(result == undefined) {
    res.redirect("/notes");
  }
  else {
    const errorConfig: newConfig = {
      config: {
        title: f.oldTitle,
        errors: {
          title: result
        }
      }
    }
    res.status(200).send(eta.render("edit", errorConfig))
  }
})

app.get("/notes/:title/postpone", async (req: Request, res: Response) => {
  const title: string = req.params.title;
  const note = (new Notebook()).get(title);
  if(note == undefined) {
    res.redirect("/notes/new?title=" + title);
    return;
  }
  note.postpone();
  res.redirect("/notes");
})

app.delete("/notes/:title", async (req: Request, res: Response) => {
  const title: string = req.params.title;
  const notes = new Notebook();
  if(!notes.has(title)) {
    res.redirect("/notes/new?title=" + title);
    return;
  }
  notes.archive(title);
  if(req.get('HX-Trigger')=="delete-btn"){
    res.redirect(303, "/notes");
  } else {
    res.send("");
  }
})

app.listen(port, () => {
  console.log(`Listening on ${port} ...`);
});
