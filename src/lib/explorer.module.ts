
import { pack } from './main';
import { Flux, BuilderView, ModuleFlux, Pipe, Schema, Property, contract, Scene, RenderView,
    expectSome, Context, Journal} from '@youwol/flux-core'

import { ImmutableTree } from '@youwol/fv-tree';
import { attr$, render, VirtualDOM } from '@youwol/flux-view';
import { filter, map, tap } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';
import { Interfaces } from './implementation/interfaces';
import * as expectations from './expectations';

//Icons made by <a href="https://www.flaticon.com/authors/good-ware" title="Good Ware">Good Ware</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
let svgIcon = `
<path d="M451.52,221.76h-35.2c-4.21-44.47-43.673-77.107-88.143-72.897c-38.644,3.658-69.239,34.254-72.897,72.897h-51.04    c-4.21-44.47-43.673-77.107-88.143-72.897c-38.644,3.658-69.239,34.254-72.897,72.897H8c-4.418,0-8,3.582-8,8s3.582,8,8,8h35.2    c4.21,44.47,43.673,77.107,88.143,72.897c38.644-3.658,69.239-34.254,72.897-72.897h51.12c4.21,44.47,43.673,77.107,88.143,72.897    c38.644-3.658,69.239-34.254,72.897-72.897h35.12c4.418,0,8-3.582,8-8S455.938,221.76,451.52,221.76z M123.68,294.72h-0.16    c-35.876-0.088-64.888-29.243-64.8-65.12c0.088-35.876,29.243-64.888,65.12-64.8c35.814,0.088,64.8,29.146,64.8,64.96    C188.64,265.636,159.556,294.72,123.68,294.72z M335.84,294.72h-0.16c-35.876-0.088-64.888-29.243-64.8-65.12    c0.088-35.876,29.243-64.888,65.12-64.8c35.814,0.088,64.8,29.146,64.8,64.96C400.8,265.636,371.716,294.72,335.84,294.72z"/>
<path d="M132.56,178.96L132.56,178.96c-4.418,0-8,3.582-8,8s3.582,8,8,8c14.536,0,26.32,11.784,26.32,26.32c0,4.418,3.582,8,8,8    s8-3.582,8-8C174.88,197.907,155.933,178.96,132.56,178.96z"/>
<path d="M344.24,178.96L344.24,178.96c-4.418,0-8,3.582-8,8s3.582,8,8,8c14.536,0,26.32,11.784,26.32,26.32c0,4.418,3.582,8,8,8    s8-3.582,8-8C386.56,197.907,367.613,178.96,344.24,178.96z"/>
`

/**
# Explorer

The explorer module allows to browse one or multiple drive(s) to retrieve data stored from various places (youwol, google drive, local files, etc).

> For now the explorer module is a readonly component: no action that create or update the files/folders are exposed. 
> More about this in the roadmap.

## Configuration

The configuration of the module is described in the [[Explorer.PersistentData | PersistentData section]]

## Inputs/Outputs

The module feature one input an one output.

### The *drive* input

The drive input accepts data that can be used to retrieve one or more [[Interfaces.Drive | drive]].
Each of the drives are then included in the explorer.


### The *selection* output

The module emit through its output the selection when the user click on items. The actual data sent 
depends on the module's configuration, please check the [[Explorer.PersistentData | PersistentData section]].


## Roadmap

### Enable contextual actions

For now no contextual actions are enabled in this module.
It can be interesting to provide actions such as folde creation, renamings, etc.

 */
export namespace ModuleExplorer {


    /**
     * 
     * 
      ## **selectionEmit**

      This parameter control which selection are emitted when the user click on item(s).
      The parameter takes a value in [**single file only**, **all**].

      ### single file only

      When **selectionEmit** is set to *single file only* the output of the module emit only when a single file is clicked on the explorer.
      The data that is send to the output is the corresponding file (following the [[Interfaces.File]] interface).
        
      ### all

      When **selectionEmit** is set to *all* the output of the module emit at anytime when selection changes.
      The data that is send to the output is of the following the structure [[Explorer.MultiSelection]].
     */
    @Schema({
        pack: pack,
        description: "Persistent Data of Explorer"
    })
    export class PersistentData {

        
        @Property({ 
            description: "",
            enum: ["single file only", "all"] 
        })
        readonly selectionEmit: string


        constructor({ selectionEmit }:
            { selectionEmit?: string, 
            } = {}) {
                this.selectionEmit = selectionEmit != undefined ? selectionEmit : "single file only"
        }
    }

    
    /**
     * MultiSelection data structure
     * 
     */
    export class MultiSelection{ 
        
        constructor( public readonly files: Array<Interfaces.File>, 
                     public readonly folders: Array<Interfaces.Folder> ){}
    }


    type SingleSelection = Interfaces.File

    @Flux({
        pack: pack,
        namespace: ModuleExplorer,
        id: "Explorer",
        displayName: "Explorer",
        description: "This module allows to explore files and data in your workspace",
        resources: {
            'technical doc': `${pack.urlCDN}/dist/docs/modules/lib_explorer_module.moduleexplorer.html`,
        }
    })
    @BuilderView({
        namespace: ModuleExplorer,
        icon: svgIcon
    })
    @RenderView<Module>({
        namespace: ModuleExplorer,
        render: (mdle) => renderHtmlElement(mdle),
        wrapperDivAttributes: (_) => {
            return { style: { height: "100%", width: "100%" } }
        }
    })
    export class Module extends ModuleFlux {

        outSelection$: Pipe<SingleSelection | MultiSelection>

        scene : Scene<Interfaces.Drive>

        treeState = new ImmutableTree.State<ImmutableTree.Node>( {
            rootNode: new RootNode({id:'root', name:'root', children:[]}), 
            expandedNodes:['root']
        })

        /**
         * This map stores the context that have been join to the input drives.
         * When selection is emitted this context is forwarded in the output.
         */
        contextsMap : {[key:string]: Context} = {}
        outputContextsMap : {[key:string]: Context} = {}

        constructor(params) {
            super(params)

            this.addInput({
                id: 'drive',
                description: "append some drives into the explorer",
                contract: contract({
                    description:"expect to retrieve one or multiple drive(s)",
                    requireds:{ 
                        drives: expectSome<Interfaces.Drive>( { when: expectations.drive } )
                    }
                }),
                onTriggered: ({data, configuration, context}) => this.addDrives( data.drives, configuration, context )
            })

            this.outSelection$ = this.addOutput({id:"selection"})

            this.scene = new Scene<Interfaces.Drive>(
                (drive: Interfaces.Drive ) => drive.name,
                (drive: Interfaces.Drive ) => this.addDrive(drive),
                (drive: Interfaces.Drive ) => this.removeDrive(drive),  
                () => true
            )
        }

        addDrive( drive : Interfaces.Drive){

            let driveNode = new DriveNode({drive})
            this.treeState.addChild('root', driveNode )
        }

        removeDrive( drive : Interfaces.Drive){
            this.treeState.removeNode(drive.name)
        }

        addDrives( drives: Array<Interfaces.Drive>, config: PersistentData, context: Context) {

            drives.forEach( drive => {
                this.contextsMap[drive.id] = context 
                this.outputContextsMap[drive.id] = new Context(
                    'selection processing context',
                    context.userContext,
                    this.logChannels 
                )
                this.addJournal({
                    title: `selection for drive "${drive.name}"`,
                    entryPoint: this.outputContextsMap[drive.id]
                })
            })
            this.scene = this.scene.add(drives)
            context.end()
        }

        onSelected(node: Node){
            if(! (node instanceof DriveChildNode))
                return 

            let outputContext = this.outputContextsMap[node.drive.id]

            if( this.getPersistentData<PersistentData>().selectionEmit == "single file only" && 
                node instanceof FileNode )
                this.outSelection$.next({data:node.file, context: outputContext})
            
            if( this.getPersistentData<PersistentData>().selectionEmit == "all" &&
                node instanceof FileNode)
                this.outSelection$.next({ data: new MultiSelection([node.file], []), context: outputContext}) 
                
            if( this.getPersistentData<PersistentData>().selectionEmit == "all" &&
                node instanceof FolderNode)
                this.outSelection$.next({data:new MultiSelection([], [node.folder]), context: outputContext}) 
                
        }
    }


    export class Node extends ImmutableTree.Node{

        name: string

        events$ : Observable<Interfaces.EventIO>

        constructor({id, name, children, events$}: {id: string,name: string, events$?: Observable<Interfaces.EventIO>, children? } ){
            super({id,children})
            this.name = name
            this.events$ = events$ || new Subject<Interfaces.EventIO>()
        }
    }

    export class DriveChildNode extends Node{

        drive: Interfaces.Drive

        constructor({
            id, 
            name, 
            children, 
            events$,
            drive}: { 
                id: string, 
                name: string, 
                drive: Interfaces.Drive, 
                children?,
                events$?:  Observable<Interfaces.EventIO> 
            }){

            super({
                id,
                name, 
                children,
                events$ : events$ || drive.events$.pipe( 
                    filter( (event: Interfaces.EventIO) => {
                        return event.targetId == id 
                    })
                )
            })
            this.drive = drive
        }
    }

    export class RootNode extends ImmutableTree.Node{

        name: string

        constructor({id, name, children}: {id: string,name: string, children? } ){
            super({id,children})
            this.name = name
        }
    }

    function children( drive: Interfaces.Drive, parentId: string ) {
        
        return drive.listItems(parentId).pipe( 
            map(({files, folders}) => {
                return [
                    ...files.map( file => new FileNode({file})),
                    ...folders.map( folder => new FolderNode({folder}))
                ]
            })
        )
    }


    export class DriveNode extends DriveChildNode{

        drive: Interfaces.Drive

        constructor(
            {drive}: { drive: Interfaces.Drive} ){
            super({ 
                id: drive.name, 
                name: drive.name, 
                children: children(drive, drive.id), 
                drive,
                events$: drive.events$.pipe( 
                    filter( (event: Interfaces.EventIO) => {
                        return event.targetId == drive.id 
                    })
                )
            })
            this.drive = drive
        }
    }

    export class FileNode extends DriveChildNode{

        file: Interfaces.File

        constructor(
            {file}: { file: Interfaces.File} ){
            super({ 
                id: file.id, 
                name: file.name, 
                drive:  file.drive
            })

            this.file = file
        }
    }

    export class FolderNode extends DriveChildNode{

        folder : Interfaces.Folder

        constructor(
            {folder}: { folder: Interfaces.Folder} ){
            super({ 
                id: folder.id, 
                name: folder.name, 
                children:  children(folder.drive, folder.id), 
                drive: folder.drive
                })
            this.folder = folder
        }
    }

    //--------------------------------------------------------
    // View 
    //--------------------------------------------------------

    function renderHtmlElement(mdle: Module) {

        let view = new ImmutableTree.View({
            state: mdle.treeState,
            headerView: (state, node) => headerView(state, node),
            connectedCallback : (elem) => {
                elem.subscriptions.push(
                    mdle.treeState.selectedNode$.subscribe( node => mdle.onSelected(node as DriveChildNode))
                )
            },
            class: 'fv-bg-background fv-text-primary h-100 overflow-auto',
        } as any)

        return render(view)
    }

    export function headerView( 
        _: ImmutableTree.State<Node>, 
        node: Node, 
        customHeadersView : Array<{target: (Node)=>boolean, classes?, icon? }> = []) : VirtualDOM {

        let defaultIcon = ""

        let customHeader = customHeadersView.find(custom => custom.target(node))

        if(node instanceof RootNode)
            return { innerText: node.name }
        
        if(node instanceof DriveNode)
            defaultIcon = "fas fa-hdd"
        
        if(node instanceof FileNode)
            defaultIcon = "fas fa-file"
        
        if(node instanceof FolderNode)
            defaultIcon = "fas fa-folder"

        let icon = (customHeader && customHeader.icon) 
            ? customHeader.icon
            : defaultIcon
        let classes = (customHeader && customHeader.classes) 
            ?  customHeader.classes
            : 'd-flex align-items-center fv-pointer' 

        return {
            class:classes ,
            children:[
                { class : icon + " px-2" },
                { innerText: node.name },
                { class : attr$( 
                    node.events$,
                    (event: Interfaces.EventIO) => event.step == Interfaces.Step.FINISHED ? '' : 'fas fa-spinner fa-spin'
                    )
                }
            ]
        }
    }

}

