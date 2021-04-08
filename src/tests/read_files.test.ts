import { Subject } from "rxjs";
import { mergeMap, skip, take } from "rxjs/operators";
import { Interfaces, Json } from "../lib/implementation/interfaces";
import { LocalDrive, LocalFile } from "../lib/implementation/local-drive";
import { MockFolderHandler } from "./mock-folder-handler";

console.log = () =>{}

export let mockData = {
    "":{
        files:{
            "fileText": new Blob(["text content"]),
            "fileJson": new Blob([JSON.stringify({content:"text content"})]),
            "fileBytes": new Blob([new Float32Array([0,1,2,3,4])]),
        },
        folders:[
        ]
    }
}

test('read text', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(mockData))

    drive.getFile('fileText').pipe(
        mergeMap( (file:LocalFile) =>  file.readAsText()
        )
    )
    .subscribe( (content: string) => {
        expect(content).toEqual("text content")
        done()
    })
})

test('read json', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(mockData))

    drive.getFile('fileJson').pipe(
        mergeMap( (file:LocalFile) =>  file.readAsJson()
        )
    )
    .subscribe( (content: Json) => {
        expect(content).toEqual({content:"text content"})
        done()
    })
})

test('read bytes', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(mockData))

    drive.getFile('fileBytes').pipe(
        mergeMap( (file:LocalFile) =>  file.read()
        )
    )
    .subscribe( (content: ArrayBuffer) => {
        expect(content).toBeInstanceOf(ArrayBuffer)
        done()
    })
})


test('read dataUrl', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(mockData))

    drive.getFile('fileText').pipe(
        mergeMap( (file:LocalFile) =>  file.readAsDataUrl()
        )
    )
    .subscribe( (url: string) => {
        expect(url).toEqual("data:application/octet-stream;base64,dGV4dCBjb250ZW50")
        done()
    })
})

test('read json error', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(mockData))

    drive.getFile('fileBytes').pipe(
        mergeMap( (file:LocalFile) =>  file.readAsJson()
        )
    )
    .subscribe( 
        (content: string) => {
            throw Error("An error should have been thrown")
        },
        (err) => {
            done()
        })
})


class XHRMock{

    static responseText: string
    static readyState: number
    static status: number
    static statusText: string

    responseText: string
    readyState: number
    status: number
    statusText: string

    method:string
    static url: string
    response: any

    static headers = {}
    onload: (Event) => void
    onloadstart: (Event) => void
    onprogress: (Event) => void
    upload = {
        onprogress : undefined
    }
    open(method, url){
        this.method = method
        XHRMock.url=url
    }
    send(){
        this.onloadstart({loaded:0,total:5})
        if(this.method=="GET"){
            this.onprogress({loaded:1,total:5})
            this.onprogress({loaded:4,total:5})
            this.onprogress({loaded:5,total:5}) 
        }
        if(this.method=="POST"){
            this.upload.onprogress({loaded:1,total:5})
            this.upload.onprogress({loaded:4,total:5})
            this.upload.onprogress({loaded:5,total:5}) 
        }
        this.responseText = XHRMock.responseText
        this.status = XHRMock.status
        this.statusText = XHRMock.statusText
        this.readyState = XHRMock.readyState
        this.response = new Blob( [this.responseText])
        this.onload({loaded:5,total:5})
    }
    setRequestHeader(k,v){
        XHRMock.headers[k] = v
    }
}
  
window.XMLHttpRequest = XHRMock as any


test('download blob', (done) => {
    XHRMock.responseText = JSON.stringify({status:'completed'})
    XHRMock.readyState = 4
    XHRMock.status = 200

    let events$ = new Subject<Interfaces.EventIO>()
    events$.pipe(
        take(1)
    ).subscribe( (d) => {
        expect(d.step).toEqual(Interfaces.Step.STARTED)
        expect(d.method).toEqual(Interfaces.Method.DOWNLOAD)
        expect(d.transferedCount).toEqual(0)
        expect(d.totalCount).toEqual(5)
        expect(d.targetId).toEqual('fakeId')
    })
    events$.pipe( skip(1),take(1)).subscribe( (d) =>{
        expect(d.step).toEqual(Interfaces.Step.TRANSFERING)
        expect(d.transferedCount).toEqual(1)
    })
    events$.pipe( skip(2),take(1)).subscribe( (d) =>{
        expect(d.step).toEqual(Interfaces.Step.TRANSFERING)
        expect(d.transferedCount).toEqual(4)
    })
    events$.pipe( skip(3),take(1)).subscribe( (d) =>{
        expect(d.step).toEqual(Interfaces.Step.PROCESSING)
        expect(d.transferedCount).toEqual(5)
    })
    events$.pipe(
        skip(4), take(1)
    ).subscribe( (d) => {
        expect(d.step).toEqual(Interfaces.Step.FINISHED)
        expect(d.transferedCount).toEqual(5)
        expect(d.totalCount).toEqual(5)
    })

    Interfaces.downloadBlob("fake/url", 'fakeId', {testHeader: true}, events$, undefined, false).subscribe(
        (blob: Blob) => {
            expect(blob).toBeDefined()
            done()
        }
    )
    expect(XHRMock.headers['testHeader']).toBeTruthy()
    expect(XHRMock.url.includes("fake/url")).toBeTruthy()
    expect(XHRMock.url.length > "fake/url".length).toBeTruthy()
})


test('upload blob', (done) => {
    
    XHRMock.responseText = JSON.stringify({status:'completed'})
    XHRMock.readyState = 4
    XHRMock.status = 200

    let events$ = new Subject<Interfaces.EventIO>()
    events$.pipe(
        take(1)
    ).subscribe( (d) => {
        expect(d.step).toEqual(Interfaces.Step.STARTED)
        expect(d.method).toEqual(Interfaces.Method.UPLOAD)
        expect(d.transferedCount).toEqual(0)
        expect(d.totalCount).toEqual(5)
        expect(d.targetId).toEqual('fileId')
    })
    events$.pipe( skip(1),take(1)).subscribe( (d) =>{
        expect(d.step).toEqual(Interfaces.Step.TRANSFERING)
        expect(d.transferedCount).toEqual(1)
    })
    events$.pipe( skip(2),take(1)).subscribe( (d) =>{
        expect(d.step).toEqual(Interfaces.Step.TRANSFERING)
        expect(d.transferedCount).toEqual(4)
    })
    events$.pipe( skip(3),take(1)).subscribe( (d) =>{
        expect(d.step).toEqual(Interfaces.Step.PROCESSING)
        expect(d.transferedCount).toEqual(5)
    })
    events$.pipe(
        skip(4), take(1)
    ).subscribe( (d) => {
        expect(d.step).toEqual(Interfaces.Step.FINISHED)
        expect(d.transferedCount).toEqual(5)
        expect(d.totalCount).toEqual(5)
    })

    Interfaces.uploadBlob("fake/url", 'fake-filename', new Blob(["some content"]),
         {testHeader: true}, "fileId", events$).subscribe(
        (response: any) => {
            expect(response).toEqual({status:'completed'})
            done()
        }
    )
    expect(XHRMock.headers['testHeader']).toBeTruthy()
    expect(XHRMock.url).toEqual("fake/url")
})

test('upload blob error', (done) => {
    
    XHRMock.responseText = JSON.stringify({status:'error'})
    XHRMock.readyState = 4
    XHRMock.status = 500
    XHRMock.statusText = 'Internal Error'

    Interfaces.uploadBlob("fake/url", 'fake-filename', new Blob(["some content"]),{}).subscribe(
        (response: any) => {
        },
        (error) => {
            done()
        }
    )
})
