import React from 'react';
import {Provider} from "polar-shared/src/util/Providers";
import {
    createObservableStore,
    SetStore
} from "../../../web/spectron0/material-ui/store/ObservableStore";
import {IDocMeta} from "polar-shared/src/metadata/IDocMeta";
import {URLStr} from "polar-shared/src/util/Strings";
import {DocMetaFileRefs} from "../../../web/js/datastore/DocMetaRef";
import {Backend} from 'polar-shared/src/datastore/Backend';
import {usePersistenceLayerContext} from "../../repository/js/persistence_layer/PersistenceLayerApp";
import {useAnnotationSidebarCallbacks} from './AnnotationSidebarStore';
import {useDocMetaContext} from "../../../web/js/annotation_sidebar/DocMetaContextProvider";
import {
    AnnotationMutationCallbacks,
    AnnotationMutationsContextProvider,
    IAnnotationMutationCallbacks
} from "../../../web/js/annotation_sidebar/AnnotationMutationsContext";
import {NULL_FUNCTION} from "polar-shared/src/util/Functions";
import {Finder, FindHandler} from "./Finders";

export interface IDocViewerStore {

    /**
     * The DocMeta currently being managed.
     */
    readonly docMeta?: IDocMeta;

    /**
     * The storage URL for the document this docMeta references.
     */
    readonly docURL?: URLStr;


    readonly findActive: boolean;

    /**
     * The finder used when searching documents.  This is set once the document
     * is loaded.
     */
    readonly finder?: Finder;

    readonly findHandler?: FindHandler;

}

export interface IDocViewerCallbacks {

    readonly setDocMeta: (docMeta: IDocMeta) => void;
    readonly annotationMutations: IAnnotationMutationCallbacks;

    readonly setFinder: (finder: Finder) => void;

    readonly setFindActive: (findActive: boolean) => void;

    readonly setFindHandler: (findHandler: FindHandler | undefined) => void;


    // FIXME: where do we put the callback for injecting content from the
    // annotation control into the main doc.

}

const initialStore: IDocViewerStore = {
    findActive: false
}

interface Mutator {

}

function mutatorFactory(storeProvider: Provider<IDocViewerStore>,
                        setStore: SetStore<IDocViewerStore>): Mutator {

    function reduce(): IDocViewerStore | undefined {
        return undefined;
    }

    return {};

}

type IDocMetaProvider = () => IDocMeta | undefined;

function callbacksFactory(storeProvider: Provider<IDocViewerStore>,
                          setStore: (store: IDocViewerStore) => void,
                          mutator: Mutator): IDocViewerCallbacks {

    const docMetaContext = useDocMetaContext();
    const persistenceLayerContext = usePersistenceLayerContext();
    const annotationSidebarCallbacks = useAnnotationSidebarCallbacks();

    const docMetaProvider = React.useMemo<IDocMetaProvider>(() => {

        return () => {
            const store = storeProvider();
            return store.docMeta;
        }

    }, []);

    function setDocMeta(docMeta: IDocMeta) {

        function doExec() {
            const store = storeProvider();

            const computeDocURL = (): URLStr | undefined => {

                if (docMeta) {

                    const docMetaFileRef = DocMetaFileRefs.createFromDocMeta(docMeta);
                    const persistenceLayer = persistenceLayerContext.persistenceLayerProvider();

                    if (docMetaFileRef.docFile) {
                        const file = persistenceLayer.getFile(Backend.STASH, docMetaFileRef.docFile);
                        return file.url;
                    }

                }

                return undefined;

            };

            const docURL = store.docURL || computeDocURL();

            setStore({...store, docMeta, docURL});

        }

        // update the main store.
        doExec();

        docMetaContext.setDoc({docMeta, mutable: true});

        // update the annotation sidebar
        annotationSidebarCallbacks.setDocMeta(docMeta);

    }

    const annotationMutations = AnnotationMutationCallbacks.create(updateStore, NULL_FUNCTION);

    function updateStore(docMetas: ReadonlyArray<IDocMeta>) {
        // this is almost always just ONE item at a time so any type of
        // bulk performance updates are pointless
        docMetas.map(setDocMeta);
    }

    function setFinder(finder: Finder) {
        const store = storeProvider();
        setStore({...store, finder});
    }

    function setFindHandler(findHandler: FindHandler | undefined) {
        const store = storeProvider();
        setStore({...store, findHandler});
    }

    function setFindActive(findActive: boolean) {

        const store = storeProvider();

        if (findActive) {
            setStore({...store, findActive})
        } else {
            if (store.findHandler) {
                store.findHandler!.cancel();
            }
            setStore({...store, findActive, findHandler: undefined})
        }

    }

    return {
        setDocMeta,
        setFinder,
        setFindHandler,
        annotationMutations,
        setFindActive
    };

}

export const [DocViewerStoreProviderDelegate, useDocViewerStore, useDocViewerCallbacks, useDocViewerMutator]
    = createObservableStore<IDocViewerStore, Mutator, IDocViewerCallbacks>({
        initialValue: initialStore,
        mutatorFactory,
        callbacksFactory
    });

interface IProps {
    readonly children: React.ReactElement;
}

const DocViewerStoreInner = React.memo((props: IProps) => {

    const docViewerCallbacks = useDocViewerCallbacks();

    return (
        <AnnotationMutationsContextProvider value={docViewerCallbacks.annotationMutations}>
            {props.children}
        </AnnotationMutationsContextProvider>
    );
});


export const DocViewerStore = React.memo((props: IProps) => {
    return (
        <DocViewerStoreProviderDelegate>
            <DocViewerStoreInner>
                {props.children}
            </DocViewerStoreInner>
        </DocViewerStoreProviderDelegate>
    );
});


