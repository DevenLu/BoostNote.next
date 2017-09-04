import PouchDB from 'pouchdb-browser'
import Types from 'client/Types'
import Client from './Client'

const DefaultRepositoryName = 'Local'
const DefaultFolderName = 'Notes'

const serializedRepositoryMapKey = 'SERIALIZED_REPOSITORY_MAP'

type SerializedRepositoryMap = {
  [name: string]: RepositoryParams
}

const defaultSerializedRepositoryMap: SerializedRepositoryMap = {
  [DefaultRepositoryName]: {
  }
}

type RepositoryParams = {
}

interface Note extends Types.Note {
  isDeleted?: Date
}

type NoteMap = Map<string, Note>

type Folder = {

}

type FolderMap = Map<string, Folder>

type SerializedRepositoryBundle = {
  noteMap: NoteMap
  folderMap: FolderMap
}

export type SerializedRepositoryBundleMap = Map<string, SerializedRepositoryBundle>

export type RepositoryMap = Map<string, Repository>

export class Repository {
  private static repositoryMap: RepositoryMap = new Map()
  public localStorage: Storage
  public PouchDB: PouchDB.Static

  public static async create (name: string, params: RepositoryParams) {
    const repository = new Repository(name, params)
    Repository.repositoryMap.set(name, repository)
    await Repository.saveRepositoryMap()
    return repository
  }

  public static async remove (name: string) {
    if (!Repository.repositoryMap.has(name)) throw new Error('Repository doesnt exist')
    Repository.repositoryMap.delete(name)
    await Repository.saveRepositoryMap()
  }

  public static async loadRepositoryMap () {
    Repository.repositoryMap.clear()
    const promises = Repository.getSerializedEntriesFromLocalStorage()
      .map(([name, params]) =>
        Repository
          .create(name, params)
          .then(repository => Repository.repositoryMap.set(name, repository))
      )
    await Promise.all(promises)
  }

  public static async initialize (): Promise<RepositoryMap> {
    await Repository.loadRepositoryMap()
    return Repository.repositoryMap
  }

  private static getSerializedEntriesFromLocalStorage (): Array<[string, RepositoryParams]> {
    const serializedRepositoryMap: SerializedRepositoryMap = JSON.parse(this.prototype.localStorage.getItem(serializedRepositoryMapKey))
    if (!serializedRepositoryMap) {
      return Object.entries(defaultSerializedRepositoryMap)
    }
    return Object.entries(serializedRepositoryMap)
  }

  public static async getSerializedRepositoryBundleMap (): Promise<SerializedRepositoryBundleMap> {
    const serializedEntries = await Promise.all(Array.from(Repository.repositoryMap.entries())
      .map(([name, repository]) => {
        return repository
          .getBundle()
          .then((serializedRepositoryBundle) => ({
            name,
            serializedRepositoryBundle
        }))
      }))

    return serializedEntries
      .reduce((partialMap, {name, serializedRepositoryBundle}) => {
        partialMap.set(name, serializedRepositoryBundle)
        return partialMap
      }, new Map())
  }

  public static async saveRepositoryMap () {
    const entries = Array.from(Repository.repositoryMap.entries())
    const serializedMap = entries
      .reduce((acc, [name, repository]) => {
        acc[name] = repository.serialize()
        return acc
      }, {} as SerializedRepositoryMap)
    this.prototype.localStorage.setItem(serializedRepositoryMapKey, JSON.stringify(serializedMap))
  }

  public static get (repositoryName: string): Repository {
    return Repository.repositoryMap.get(repositoryName)
  }

  constructor (name: string, params: RepositoryParams) {
    this.db = new Client<Note>(name)
  }

  private db: Client<Note>

  private serialize (): Types.Repository {
    return {
    }
  }

  public async getBundle () {
    const noteMap = await this.getNoteMap()
    const folderMap = new Map()
    for (const [id, note] of noteMap) {
      if (!folderMap.has(note.folder)) {
        folderMap.set(note.folder, {})
      }
    }

    if (!folderMap.has(DefaultFolderName)) {
      folderMap.set(DefaultFolderName, {})
    }

    return {
      ...(await this.serialize()),
      noteMap,
      folderMap,
    }
  }

  public async getNoteMap (): Promise<NoteMap> {
    return this.db.getAlldocs()
  }

  public async hasNote (noteId: string) {
    const note = await this.db.get(noteId)
    if (note == null) return false
    return true
  }

  public async putNote (noteId: string, noteParams: Partial<Note>): Promise<Note> {
    const note = await this.db.get(noteId)
    const mergedNote: Note = {
      ...note,
      ...noteParams,
    }

    return await this.db
      .put(noteId, {
        ...mergedNote
      })
      .then(() => mergedNote)
  }

  public async removeNote (noteId: string) {
    const note = await this.db.get(noteId)

    return await this.db.put(noteId, {
      ...note,
      isDeleted: new Date(),
    })
  }
}

Repository.prototype.localStorage = window.localStorage
Repository.prototype.PouchDB = PouchDB
