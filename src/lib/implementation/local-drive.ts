
import { from, Observable, of, Subject } from 'rxjs';
import { map, merge, mergeMap, tap } from 'rxjs/operators';
import { Interfaces } from './interfaces';


export class LocalFile extends Interfaces.File {

    constructor(public readonly handle, id, name, folderId, drive, type) {
        super(id, name, folderId, drive, type)
    }
}
export class LocalFolder extends Interfaces.Folder {

    constructor(public readonly handle, id, name, folderId, drive) {
        super(id, name, folderId, drive)
    }
}

export class LocalDrive extends Interfaces.Drive {

    constructor(
        id: string, 
        name: string, 
        public readonly rootFolderHandle
        ) {
        super(id, name)
    }

    blob(itemId: string, events$: Subject<Interfaces.Event> = undefined): Observable<File> {

        events$ = events$ || this.events$
        let follower = new Interfaces.RequestFollower({
            targetId: itemId,
            channels$: [events$],
            method: Interfaces.Method.DOWNLOAD
        })
        // Don't know how to get progress on file loading => hence the size of '1'
        follower.start(1)

        return this.getFile(itemId).pipe(
            mergeMap((file) => {
                return from(file.handle.getFile()) as Observable<File>
            }),
            tap((file: File) => {
                follower.end()
            })
        ) 
    }

    listItems(
        folderId: string,
        maxResults: number = 100,
        beginIterator: string = undefined,
        events$: Subject<Interfaces.Event> = undefined
    ): Observable<{ folders: Array<LocalFolder>, files: Array<LocalFile>, endIterator: string | undefined }> {

        events$ = events$ || this.events$
        let follower = new Interfaces.RequestFollower({
            targetId: folderId,
            channels$: [events$],
            method: Interfaces.Method.QUERY
        })

        let getData = async (handle) => {

            follower.start()
            let items = { folders: [], files: [], endIterator: undefined }
            for await (const item of handle.entries()) {
                let path: Array<string> = await this.rootFolderHandle.resolve(item[1])
                let id = path.join('/')
                item[1].kind == "directory"
                    ? items.folders.push(new LocalFolder(item[1], id, item[1].name, folderId, this))
                    : items.files.push(new LocalFile(item[1], id, item[1].name, folderId, this, ""))
            }
            return items
        }
        return this.getFileOrFolderHandle(folderId).pipe(
            mergeMap((handle) => from(getData(handle))),
            tap(() => follower.end())
        )
    }

    createFile(folderId: string, name: string, content: Blob): Observable<LocalFile> {

        return this.getFolder(folderId).pipe(
            mergeMap(folder => {
                return from(folder.handle.getFileHandle(name, { create: true }));
            }),
            map((fileHandle) => {
                return new LocalFile(fileHandle, folderId + '/' + name, name, folderId, this, "")
            }),
            mergeMap((file) => {
                return this.updateFile(file, content)
            })
        )
    }

    createFolder(parentFolderId: string, name: string): Observable<any> {

        return this.getFolder(parentFolderId).pipe(
            mergeMap(folder => from(folder.handle.getDirectoryHandle(name, { create: true }))),
            map((handle) => new LocalFolder(handle, parentFolderId + "/" + name, name, parentFolderId, this))
        )
    }

    updateFile(file: LocalFile, content): Observable<LocalFile> {
        let write = async () => {
            const writable = await file.handle.createWritable();
            await writable.write(content);
            await writable.close();
            return file
        }
        return from(write())
    }

    getFile(itemId: string, events$: Subject<Event> = undefined): Observable<LocalFile | never> {

        return this.getFileOrFolderHandle(itemId).pipe(
            map(handle => {
                let name = itemId.split('/').slice(-1)[0]
                let folderId = itemId.split('/').slice(0, -1).join('/')
                return new LocalFile(handle, itemId, name, folderId, this, "")
            })
        )
    }

    getFolder(itemId: string, events$: Subject<Event> = undefined): Observable<LocalFolder> {

        return this.getFileOrFolderHandle(itemId).pipe(
            map(handle => new LocalFolder(handle, itemId, itemId.split('/')[0], itemId.split('/').slice(0, -1).join('/'), this))
        )
    }

    renameItem(item: LocalFile | Interfaces.Folder | Interfaces.Drive, newName: string):
        Observable<LocalFile> {

        if (item instanceof Interfaces.Folder || item instanceof Interfaces.Drive)
            throw Error("Drive/Folder renaming has not been implemented in local-drive module")

        return this.blob(item.id).pipe(
            mergeMap((blob) => this.createFile(item.parentFolderId, newName, blob)),
            mergeMap((file: LocalFile) => this.deleteFile(item.id).pipe(map(d => file)))
        )
    }

    deleteFile(fileId: string): Observable<any> {

        let parentId = fileId.split('/').slice(0, -1).join('/')
        return this.getFolder(parentId).pipe(
            mergeMap(folder => {
                let name = fileId.split('/').slice(-1)[0]
                return from(folder.handle.removeEntry(name))
            })
        )
    }

    deleteFolder(folderId: string): Observable<any> {

        let folderName = folderId.split('/').slice(-1)[0]
        let parentFolderId = folderId.split('/').slice(0, -1).join('/')

        return this.getFileOrFolderHandle(parentFolderId).pipe(
            mergeMap((folder: any) => {
                return from(folder.removeEntry(folderName, { recursive: true }))
            })
        )
    }

    getFileOrFolderHandle(itemId) {
        if (itemId == "" || itemId == this.id)
            return of(this.rootFolderHandle)

        let getNext = async (folderHandle, remainingPath: string) => {

            let parts = remainingPath.split('/').filter(p => p != "")

            for await (const item of folderHandle.entries()) {
                if (item[1].name == parts[0] && parts.length > 1)
                    return await getNext(item[1], parts.slice(1).join('/'))
                if (item[1].name == parts[0] && parts.length == 1)
                    return item[1]
            }
            throw Error("can not find the specified file/folder " + itemId)
        }
        return from(getNext(this.rootFolderHandle, itemId))
    }
}