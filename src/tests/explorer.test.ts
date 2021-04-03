import { Context, instantiateModules, ModuleError, parseGraph, renderTemplate, Runner,  } from "@youwol/flux-core"
import { Subject } from "rxjs"
import { delay, skip, take, tap } from "rxjs/operators"
import { ModuleExplorer } from "../lib/explorer.module"
import { LocalDrive } from "../lib/implementation/local-drive"
import { ModuleLocalDrive } from "../lib/local-drive.module"
import { ModuleReader } from "../lib/reader.module"
import { MockFolderHandler } from "./mock-folder-handler"


console.log = () =>{}

export let mockData = {
    "":{
        files:{
            "fileText": new Blob(["text content"]),
            "fileJson": new Blob([JSON.stringify({content:"text content"})]),
            "fileBytes": new Blob([new Float32Array([0,1,2,3,4])]),
        },
        folders:[
            "folderA"
        ]
    }
}

window['showDirectoryPicker'] = () => {
    return new Promise(cb => cb(new MockFolderHandler(mockData)))
}

function validateModal(){

    let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
    expect(modalDiv).toBeDefined()
    let buttons = modalDiv.querySelectorAll('button')
    let okBttn = buttons.item(0)
    okBttn.dispatchEvent(new MouseEvent('click'))
}

function renderScene(modules){

    let div = document.createElement('div') 
    div.innerHTML = '<div id="explorer"></div>'
    document.body.appendChild(div)
    renderTemplate(div, Object.values(modules))
}



function createWorkflow({mode,selection, withReader}: {mode:string, selection: string, withReader: boolean}){

    let branches = withReader 
        ? [ '-|~localDrive~|---|~explorer~|---|~reader~|' ] 
        : [ '-|~localDrive~|---|~explorer~|-']
    let modules     : {
        localDrive: ModuleLocalDrive.Module,
        explorer: ModuleExplorer.Module,
        reader: ModuleReader.Module
    } = instantiateModules({
        localDrive: ModuleLocalDrive,
        explorer: [ModuleExplorer, {selectionEmit: selection }],
        reader: [ModuleReader, {mode}]
    }) 
    let graph       = parseGraph( { branches, modules } )
    return {graph, modules}
}


test('explorer + reader', (done) => {
    
    let {graph, modules}       = createWorkflow({mode: 'text', selection:"single file only", withReader: true})
    
    new Runner( graph )
    renderScene(modules)
    validateModal()

    let explorerDiv = document.getElementById("explorer")

    let select$ = new Subject<{id:string, test:(HTMLDivElement)=>void}>()

    select$.pipe(
        tap( ({id}) => explorerDiv.querySelector(`#node-${id} .fv-tree-header`).dispatchEvent( new MouseEvent('click')) ),
        delay(0)
    ).subscribe( ({id, test}) => test(explorerDiv.querySelector(`#node-${id}`)) )
    
    setTimeout( () => {
        select$.next({
            id:'local-drive', 
            test: (div) => {
                let fileTextDiv = div.querySelector('#node-fileText')
                expect(fileTextDiv).toBeTruthy() 
                let folderDiv = div.querySelector('#node-folderA')
                expect(folderDiv).toBeTruthy() 

                div.querySelector('#node-fileText .fv-tree-header').dispatchEvent( new MouseEvent('click'))
            }
        })
    }, 0)


    modules.reader.content$
    .subscribe( ({data}) => {
        expect(data.content).toEqual("text content")
        document.body.innerHTML = ""
        done()
    })
})



test('explorer multi selection', (done) => {

    let {graph, modules}       = createWorkflow({mode: 'text', selection:"all", withReader: true})
    
    new Runner( graph )   
    renderScene(modules)
    validateModal()

    let explorerDiv = document.getElementById("explorer")

    let select$ = new Subject<{id:string, test:(HTMLDivElement)=>void}>()

    select$.pipe(
        tap( ({id}) => explorerDiv.querySelector(`#node-${id} .fv-tree-header`).dispatchEvent( new MouseEvent('click')) ),
        delay(0)
    ).subscribe( ({id, test}) => test(explorerDiv.querySelector(`#node-${id}`)) )
    
    setTimeout( () => {
        select$.next({
            id:'local-drive', 
            test: (div) => {
                div.querySelector('#node-fileText .fv-tree-header').dispatchEvent( new MouseEvent('click'))
                div.querySelector('#node-folderA .fv-tree-header').dispatchEvent( new MouseEvent('click'))
            }
        })
    }, 0)

    modules.explorer.outSelection$.pipe(take(1))
    .subscribe( ({data}:{data: ModuleExplorer.MultiSelection}) => {
        expect(data.files.length).toEqual(1)
    })

    modules.explorer.outSelection$.pipe(skip(1),take(1))
    .subscribe( ({data}:{data: ModuleExplorer.MultiSelection}) => {
        expect(data.folders.length).toEqual(1)
        document.body.innerHTML = ""
        done()
    })
})


test('multiple drives',(done) => {

    let branches = [ 
        '-|~localDrive~|---|~explorer~|--',
        '-|~localDrive1~|---|~explorer~|--',
        '-|~localDrive2~|---|~explorer~|--',
    ] 
    let modules     : {
        explorer: ModuleExplorer.Module,
    } = instantiateModules({
        explorer: ModuleExplorer,
    }) 
    let drive = new LocalDrive("local-drive", 'custom name', new MockFolderHandler(mockData))
    let drive1 = new LocalDrive("local-drive-1", 'custom name bis', new MockFolderHandler(mockData))
    let drive2 = new LocalDrive("local-drive-2", 'custom name bis', new MockFolderHandler(mockData))

    modules.explorer.addDrives([drive], modules.explorer.getConfiguration(), new Context("",{}))
    modules.explorer.addDrives([drive1], modules.explorer.getConfiguration(), new Context("",{}))
    modules.explorer.addDrives([drive2], modules.explorer.getConfiguration(), new Context("",{}))

    expect(modules.explorer.scene.inCache.map( d => d.id)).toEqual(["local-drive","local-drive-2"])
    done()
})