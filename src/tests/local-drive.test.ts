import { instantiateModules, parseGraph, Runner,  } from "@youwol/flux-core"
import { LocalDrive } from "../lib/implementation/local-drive"
import { ModuleLocalDrive } from "../lib/local-drive.module"
import { MockFolderHandler } from "./mock-folder-handler"

console.log = () =>{}

window['showDirectoryPicker'] = () => {
    return new Promise(cb => cb(new MockFolderHandler({})))
}

function createWorkflow(){

    let branches = [
        '-|~localDrive~|--'
    ] 
    let modules     : {
        localDrive: ModuleLocalDrive.Module
    } = instantiateModules({
        localDrive: ModuleLocalDrive
    }) 
    let graph       = parseGraph( { branches, modules } )
    return {graph, modules}
}

test('local drive + ok', (done) => {
    
    let {graph, modules}       = createWorkflow()
    
    new Runner( graph )
    let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
    expect(modalDiv).toBeDefined()
    let buttons = modalDiv.querySelectorAll('button')

    let okBttn = buttons.item(0)

    okBttn.dispatchEvent(new MouseEvent('click'))
    modules.localDrive.drive$.subscribe( (drive) => {
        expect(drive.data).toBeInstanceOf(LocalDrive)
        let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
        expect(modalDiv).toBeNull()
        done()
    })
})


test('local drive + cancel', () => {
    
    let {graph}       = createWorkflow()
    
    new Runner( graph )
    let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
    expect(modalDiv).toBeDefined()

    let buttons = document.getElementById("yw-flux-files-local-drive-modal").querySelectorAll('button')
    let cancelBttn = buttons.item(1)

    cancelBttn.dispatchEvent(new MouseEvent('click'))
    modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
    expect(modalDiv).toBeNull()
})