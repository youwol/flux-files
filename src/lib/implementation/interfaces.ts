import { uuidv4 } from '@youwol/flux-core';
import { Observable, of, ReplaySubject, Subject, throwError } from 'rxjs';
import { map, mergeMap, observeOn, take } from 'rxjs/operators';


let StdFile = File
export interface JsonMap { [member: string]: string | number | boolean | null | JsonArray | JsonMap };
export interface JsonArray extends Array<string | number | boolean | null | JsonArray | JsonMap> {}
export type Json = JsonMap | JsonArray | string | number | boolean | null;

/** 
  ## Abstract 
     
     This namespace encapsulates base classes allowing browsing,
     reading, and writing like a filesystem on a local computer.

     Usually, it is a thin layer that connects to a remote client who expose resources like a tree 
     (e.g. github, google drive). It may altought not always be the case, like the 
     [[LocalDrive]] shows.

     When deriving a new drive, the central task is implementing a new type of [[Interfaces.Drive]].
     One can also inherits from [[Interfaces.File]] and [[Interfaces.Folder]] to eventually add missing required features.

 */
export namespace Interfaces {

    export enum Step {
        STARTED = "STARTED",
        TRANSFERING = "TRANSFERING",
        PROCESSING = "PROCESSING",
        FINISHED = "FINISHED",
    }

    export enum Method {
        UPLOAD = "UPLOAD",
        DOWNLOAD = "DOWNLOAD",
        DELETE = "DELETE",
        QUERY = "QUERY",
    }


    export class Response {

        readonly id: string
        readonly parentId: string
        readonly name: string
    }

    export class RequestFollower{

        public readonly targetId: string
        public readonly channels$: Array<Subject<Interfaces.Event>>
        public readonly requestId: string
        public readonly method: Method
        totalCount : number
        transferedCount : number

        constructor({ targetId, channels$ , method}: 
            {   targetId: string, 
                channels$: Subject<Interfaces.Event> | Array<Subject<Interfaces.Event>>, 
                method: Method}){
            this.targetId = targetId
            this.channels$ = Array.isArray(channels$) ? channels$ : [channels$]
            this.method = method
            this.requestId = uuidv4()
        }

        start(totalCount?:number){
            this.totalCount = totalCount
            this.channels$.forEach( channel$ => 
                channel$.next(new EventIO({
                    requestId: this.requestId, 
                    targetId: this.targetId, 
                    step: Step.STARTED, 
                    transferedCount:0,
                    totalCount: this.totalCount,
                    method: this.method
                })))
        }

        progressTo( transferedCount: number, totalCount?:number) {
            this.totalCount = totalCount != undefined ? totalCount : this.totalCount
            this.transferedCount = transferedCount
            this.channels$.forEach( channel$ => 
                channel$.next(new EventIO({
                    requestId: this.requestId, 
                    targetId: this.targetId, 
                    step: this.totalCount != undefined && this.transferedCount == this.totalCount ? Step.PROCESSING : Step.TRANSFERING, 
                    transferedCount: this.transferedCount,
                    totalCount: this.totalCount,
                    method: this.method
                })))
        }

        end() {
            this.transferedCount = this.totalCount
            this.channels$.forEach( channel$ => 
                channel$.next(new EventIO({
                    requestId: this.requestId, 
                    targetId: this.targetId, 
                    step: Step.FINISHED, 
                    transferedCount: this.transferedCount,
                    totalCount: this.totalCount,
                    method: this.method
                })))
        }

    }

    export class Event {
        
    }

    export class EventIO extends Event{

        public readonly requestId: string
        public readonly targetId: string
        public readonly method: Method
        public readonly step : Step
        public readonly totalCount : number
        public readonly transferedCount : number

        constructor({requestId, targetId, step, transferedCount, totalCount, method}){
            super()
            this.requestId = requestId
            this.targetId = targetId
            this.step = step
            this.method = method
            this.totalCount = totalCount
            this.transferedCount = transferedCount
        }
    }

    export function getFolderRec(parentFolder: Drive | Folder, path:Array<string> ) : Observable<Folder>{

        return parentFolder.drive.listItems(parentFolder.id).pipe(
            mergeMap( ({folders}) => {
                let folder = folders.find( folder => folder.name==path[0])
                if(folder && path.length==1)
                    return of(folder)
                if(folder)
                    return getFolderRec(folder, path.slice(1)).pipe( map((folder) => folder ))
                    
                throw Error(`Folder not found @ ${path.join('/')}`)
            })
        )
    }

    export function getFolderOrCreateRec(parentFolder: Drive | Folder, path:Array<string> ) : Observable<{created:boolean, folder:Folder}>{

        return parentFolder.drive.listItems(parentFolder.id).pipe(
            mergeMap( ({folders}) => {
                let folder = folders.find( folder => folder.name==path[0])
                if(folder && path.length==1)
                    return of({created:false, folder})
                if(folder)
                    return getFolderOrCreateRec(folder, path.slice(1)).pipe( map(({created, folder}) => ({created, folder}) ))

                return parentFolder.drive
                .createFolder(parentFolder.id,path[0]).pipe( 
                    mergeMap( (folder) => {
                        if(path.length==1)
                            return of({created:true, folder})

                        return getFolderOrCreateRec(folder, path.slice(1)).pipe( map(({created, folder}) => ({created, folder}) ))
                    })
                )
            })
        )
    }

   
    export function downloadBlob(
        url: string, 
        fileId: string, 
        headers: Object, 
        events$?: Subject<Interfaces.Event> | Array<Subject<Interfaces.Event>>, 
        total?:number, 
        useCache=true)
    : Observable<Blob> {
        
        let follower = new Interfaces.RequestFollower({
            targetId: fileId, 
            channels$: events$ || [],
            method: Interfaces.Method.DOWNLOAD
        })

        let response$ = new ReplaySubject<Blob>(1)
        const xhr = new XMLHttpRequest()
        if(!useCache)
            url = url + '?_=' + new Date().getTime()

        xhr.open('GET', url)
        Object.entries(headers).forEach( ([key,val]:[string,string]) => {
            xhr.setRequestHeader(key, val)
        })
        
        xhr.responseType = 'blob'

        xhr.onloadstart = (event) => follower.start( total || event.total)

        xhr.onprogress = (event) => follower.progressTo(event.loaded)

        xhr.onload = (e) => {
            follower.end()
            response$.next(xhr.response)
        }
        xhr.send()
        return response$
    }

    export function uploadBlob(
        url: string, 
        fileName: string, 
        blob: Blob, 
        headers, 
        fileId?: string, 
        events$?: Subject<Interfaces.Event> | Array<Subject<Interfaces.Event>> 
        ): Observable<any | Error> {

        let follower = new Interfaces.RequestFollower({
            targetId: fileId, 
            channels$: events$ || [],
            method: Interfaces.Method.UPLOAD
        })
        
        let file = new StdFile([blob], fileName,{type:blob.type})
        let formData = new FormData();
        formData.append("file", file);

        var xhr = new XMLHttpRequest();
        let response = new ReplaySubject<any>(1)
            
        xhr.open("POST", url, true);
        Object.entries(headers).forEach( ([key,val]:[string,string]) => {
            xhr.setRequestHeader(key, val)
        })

        xhr.onloadstart = (event) => 
            follower.start( event.total )
        
        xhr.upload.onprogress = (event) => follower.progressTo(event.loaded)

        xhr.onload = (event) => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200){
                    follower.end()
                    response.next( JSON.parse(xhr.responseText)) 
                }
                else {
                    response.next( new Error(xhr.statusText))
                }
            }
        };
        xhr.send(formData);
        return response.pipe(
            map( resp => {
                if(resp instanceof Error)
                    throw resp
                return resp
            })
        )
    }

    export class File {

        constructor( public readonly id: string, public readonly name: string,  public readonly parentFolderId: string,
            public readonly drive: Drive, public readonly contentType: string){}

        
        read(events$?: Subject<Event>): Observable<ArrayBuffer> {
            return this.drive.read(this.id, events$)
        }
        readAsText(events$?: Subject<Event>): Observable<string> {
            return this.drive.readAsText(this.id, events$)
        }
        readAsDataUrl(events$?: Subject<Event>, useCache=true): Observable<string> {
            return this.drive.readAsDataUrl(this.id, events$)
        }
        readAsJson(events$?: Subject<Event>, useCache=true): Observable<Json> {
            return this.drive.readAsJson(this.id, events$)
        }
    }


    export class Folder {

        constructor( public readonly id: string, public readonly name: string,  public readonly parentFolderId: string,
            public readonly drive: Drive){}

        listItems(maxResults: number = 100, beginIterator?: string, events$?: Subject<Event>): Observable<{ files: Array<File>, folders: Array<Folder> }> {
            return this.drive.listItems(this.id, maxResults, beginIterator, events$)
        }

    }

    /**
     ## Abstract 
     
     This class is the base class of drives, it defines an interface that allows browsing,
     reading, and writing like a filesystem on a local computer.

     ## Exposing new drives

     Exposing a new type of drive is realized by implementing the abstract methods of this class.
     It is possible to actually implement only a subset of them, as far as the others won't be used 
     in applications.

     There is still work in progress about the *permissions* part of a drive to properly exhibit only a
     subset of the all methods delcared here.
     
     The implementation of the following methods is a minimum to expose new drive (they allow read access):
     -    [[Drive.read]]
     -    [[Drive.getFile]]
     -    [[Drive.listItems]]

     To provide write access, the following methods should be implemented:
     -    [[Drive.createFile]]
     -    [[Drive.updateFile]]
     -    [[Drive.createFolder]]
     -    [[Drive.deleteFolder]]
     -    [[Drive.deleteFile]]
     -    [[Drive.renameItem]]
     */
    export abstract class Drive {

        readonly events$ = new Subject<Event>()

        readonly drive = this 

        constructor(
            public readonly id : string, 
            public readonly name: string, 
            public readonly useCache=true
            ){}

        abstract createFile(
            parentFolderId: string, 
            name: string, 
            content: Blob, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<File>

        abstract updateContent(
            fileId: string, 
            content: Blob, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<any>

        abstract createFolder(
            parentFolderId: string, 
            name: string, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<Folder>

        abstract deleteFolder(
            folderId: string, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<any>

        abstract renameItem( 
            item: Interfaces.File | Interfaces.Folder | Interfaces.Drive, 
            newName: string, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<Interfaces.File | Interfaces.Folder | Interfaces.Drive>

        abstract blob(
            fileId: string, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<Blob>

        abstract getFile(
            fileId: string,
            events$?: Subject<Event> | Array<Subject<Event>>
            ) : Observable<File>

        abstract listItems(
            folderId: string, 
            maxResults?: number, 
            beginIterator?:string, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<{ files: Array<File>, folders: Array<Folder>, endIterator: string | undefined }>

        abstract deleteFile(
            fileId: string, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<any>

        read(
            fileId: string,
            events$?:  Subject<Event> | Array<Subject<Event>> 
            ): Observable<ArrayBuffer> {

            let toArrayBuffer = (blob: Blob) => {
                let reader = new FileReader()
                return new Observable<ArrayBuffer>(subscriber => {
                    reader.addEventListener("load", () => subscriber.next(reader.result as ArrayBuffer), false);
                    reader.readAsArrayBuffer(blob)
                    });
            }
            return this.blob(fileId, events$).pipe(
                mergeMap( (blob:Blob)=>{
                    // I believe the next call should always proceed with no error
                    return toArrayBuffer(blob) 
                }),
                take(1)
            )
        }

        readAsText(
            fileId: string,
            events$?:  Subject<Event> | Array<Subject<Event>> 
            ): Observable<string> {

            let toText = (blob: Blob) => {
                let reader = new FileReader()
                return new Observable<string>(subscriber => {
                    reader.addEventListener("load", () => subscriber.next(reader.result as string), false);
                    reader.readAsText(blob)
                  });
            }
            return this.blob(fileId, events$).pipe(
                mergeMap( (blob:Blob)=>{
                    // I believe the next call should always proceed with no error
                    return toText(blob) 
                }),
                take(1)
            )
        }

        readAsDataUrl(
            fileId: string, 
            events$?:  Subject<Event> | Array<Subject<Event>>
            ): Observable<string> {
            
            let toDataUrl = (blob: Blob) => {
                let reader = new FileReader()
                return new Observable<string>(subscriber => {
                    reader.addEventListener("load", () => subscriber.next(reader.result as string), false);
                    reader.readAsDataURL(blob)
                  });
            }
            return this.blob(fileId, events$).pipe(
                mergeMap( (blob:Blob)=> toDataUrl(blob)),
                take(1)
            )
        }

        readAsJson(
            fileId: string, 
            events$?: Subject<Event> | Array<Subject<Event>>
            ): Observable<Json> {
            
            let toJson = (blob: Blob) => {
                let reader = new FileReader()
                return new Observable<Json | Error >(subscriber => {
                    reader.addEventListener("load", () => {
                        try{
                            let json =  JSON.parse(reader.result as string)
                            subscriber.next(json) 
                        }
                        catch(error){
                            subscriber.next(error) 
                        }
                    },
                        false)                     
                    reader.readAsText(blob)
                }); 
            }
            return this.blob(fileId, events$).pipe(
                mergeMap( (blob:Blob)=> toJson(blob) ),
                map( (data: Json | Error) => {
                    if(data instanceof Error)
                        throw data
                    return data
                }),
                take(1)
            )
        }
    }
}