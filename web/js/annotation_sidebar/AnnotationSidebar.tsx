import * as React from 'react';
import {Logger} from '../logger/Logger';
import {Comment} from '../metadata/Comment';
import {DocAnnotations} from './DocAnnotations';
import {DocAnnotation, IDocAnnotation} from './DocAnnotation';
import {DocAnnotationIndex, IDString} from './DocAnnotationIndex';
import {AreaHighlightModel} from '../highlights/area/model/AreaHighlightModel';
import {MutationType} from '../proxies/MutationType';
import {TextHighlightModel} from '../highlights/text/model/TextHighlightModel';
import {isPresent} from '../Preconditions';
import {DocAnnotationComponent} from './annotations/DocAnnotationComponent';
import {CommentModel} from './CommentModel';
import {Refs} from '../metadata/Refs';
import {FlashcardModel} from './FlashcardModel';
import {Flashcard} from '../metadata/Flashcard';
import {ExportButton} from '../ui/export/ExportButton';
import {Exporters, ExportFormat} from '../metadata/exporter/Exporters';
import {SplitBar, SplitBarLeft, SplitBarRight} from '../../../apps/repository/js/SplitBar';
import {PersistenceLayerProvider} from '../datastore/PersistenceLayer';
import {NULL_FUNCTION} from '../util/Functions';
import {Doc} from '../metadata/Doc';
import {AreaHighlight} from '../metadata/AreaHighlight';
import {GroupSharingButton} from '../ui/group_sharing/GroupSharingButton';
import {DocMeta} from "../metadata/DocMeta";
import {Firebase} from "../firebase/Firebase";
import {DocMetaListeners, DocMetaRecords} from "../datastore/sharing/db/DocMetaListeners";
import {DocMetas} from "../metadata/DocMetas";
import {Profiles} from "../datastore/sharing/db/Profiles";
import {UserProfiles} from "../datastore/sharing/db/UserProfiles";

const log = Logger.create();

const NoAnnotations = () => {
    return (
        <div className="p-2">

            <h4 className="text-center text-muted text-xxl">
                No Annotations
            </h4>

            <p className="text-muted"
               style={{fontSize: '16px'}}>

                No annotations have yet been created. To create new
                annotations create a
                new <span style={{backgroundColor: "rgba(255,255,0,0.3)"}}>highlight</span> by
                selecting text in the document.
            </p>

            <p className="text-muted"
               style={{fontSize: '16px'}}>

                The highlight will then be shown here and you can
                then easily attach comments and flashcards to it
                directly.
            </p>

        </div>
    );
};

function createItems(render: IRender) {

    // https://blog.cloudboost.io/for-loops-in-react-render-no-you-didnt-6c9f4aa73778

    // TODO: I'm not sure what type of class a <div> or React element uses
    // so using 'any' for now.

    const result: any = [];

    const {annotations} = render;

    annotations.map(annotation => {
        result.push (<DocAnnotationComponent key={annotation.id}
                                             annotation={annotation}
                                             persistenceLayerProvider={render.persistenceLayerProvider}
                                             doc={render.doc}/>);
    });


    return result;

}

const AnnotationsBlock = (render: IRender) => {

    if (render.annotations.length > 0) {
        return createItems(render);
    } else {
        return <NoAnnotations/>;
    }

};

const Annotations = (render: IRender) => {

    return <div className="annotations">
        <AnnotationsBlock {...render}/>
    </div>;

};

export class AnnotationSidebar extends React.Component<IProps, IState> {

    private docAnnotationIndex: DocAnnotationIndex = new DocAnnotationIndex();

    constructor(props: IProps, context: any) {
        super(props, context);

        this.onExport = this.onExport.bind(this);

        this.state = {
            annotations: []
        };

    }

    public componentDidMount(): void {

        this.init()
            .catch(err => log.error("Failed init: ", err));

    }

    private async init() {

        await this.buildInitialAnnotations();

        await this.registerListenerForPrimaryDocMeta();

        await this.registerListenersForSecondaryDocMetas();

    }

    private async buildInitialAnnotations() {

        const docAnnotations = await DocAnnotations.getAnnotationsForPage(this.props.persistenceLayerProvider,
                                                                         this.docAnnotationIndex,
                                                                         this.props.doc.docMeta);

        this.docAnnotationIndex.put(...docAnnotations);

        this.reload();

    }

    private async registerListenerForPrimaryDocMeta() {
        const {docMeta} = this.props.doc;

        const userProfile = await UserProfiles.currentUserProfile();

        DocMetas.withSkippedMutations(docMeta, () => {
            DocMetaRecords.applyAuthorsFromUserProfile(docMeta, userProfile);
        });

        this.registerListenerForDocMeta(docMeta);
    }

    /**
     * Register listeners for group docs when using Firebase.
     */
    private async registerListenersForSecondaryDocMetas() {

        const user = Firebase.currentUser();

        if (!user) {
            return;
        }

        const fingerprint = this.props.doc.docMeta.docInfo.fingerprint;

        const docMetaHandler = (docMeta: DocMeta) => {
            this.registerListenerForDocMeta(docMeta);
        };

        const errHandler = (err: Error) => {
            log.error("Failed to handle docMeta group group: ", err);
        };

        await DocMetaListeners.register(fingerprint, docMetaHandler, errHandler);

    }

    private registerListenerForDocMeta(docMeta: DocMeta) {

        new AreaHighlightModel().registerListener(docMeta, annotationEvent => {

            const handleConversion = () => {

                const converter = (annotationValue: AreaHighlight) => {

                    const {persistenceLayerProvider} = this.props;
                    return DocAnnotations.createFromAreaHighlight(persistenceLayerProvider,
                                                                  docMeta,
                                                                  annotationValue,
                                                                  annotationEvent.pageMeta);
                };

                const docAnnotation =
                    this.convertAnnotation(annotationEvent.value, converter);

                this.handleAnnotationEvent(annotationEvent.id,
                                           annotationEvent.traceEvent.mutationType,
                                           docAnnotation);

            };

            handleConversion();

        });

        new TextHighlightModel().registerListener(docMeta, annotationEvent => {

            const docAnnotation =
                this.convertAnnotation(annotationEvent.value,
                                       annotationValue => DocAnnotations.createFromTextHighlight(docMeta,
                                                                                                 annotationValue,
                                                                                                 annotationEvent.pageMeta));

            this.handleAnnotationEvent(annotationEvent.id,
                                       annotationEvent.traceEvent.mutationType,
                                       docAnnotation);
        });

        new CommentModel().registerListener(docMeta, annotationEvent => {

            const comment: Comment = annotationEvent.value || annotationEvent.previousValue;

            if (! comment) {
                return;
            }

            const childDocAnnotation = DocAnnotations.createFromComment(docMeta,
                                                                        comment,
                                                                        annotationEvent.pageMeta);

            this.handleChildAnnotationEvent(annotationEvent.id,
                                            annotationEvent.traceEvent.mutationType,
                                            childDocAnnotation);

        });

        new FlashcardModel().registerListener(docMeta, annotationEvent => {

            const flashcard: Flashcard = annotationEvent.value || annotationEvent.previousValue;
            const childDocAnnotation = DocAnnotations.createFromFlashcard(docMeta,
                                                                          flashcard,
                                                                          annotationEvent.pageMeta);

            this.handleChildAnnotationEvent(annotationEvent.id,
                                            annotationEvent.traceEvent.mutationType,
                                            childDocAnnotation);

        });
    }

    private convertAnnotation<T>(value: any | undefined | null, converter: (input: any) => T) {

        if (! isPresent(value)) {
            return undefined;
        }

        return converter(value);

    }

    private handleChildAnnotationEvent(id: string,
                                       mutationType: MutationType,
                                       childDocAnnotation: IDocAnnotation) {

        if (! childDocAnnotation.ref) {
            // this is an old annotation.  We can't show it in the sidebar yet.
            log.warn("Annotation hidden from sidebar: ", childDocAnnotation);
            return;
        }

        if (mutationType === MutationType.DELETE) {
            this.deleteDocAnnotation(id);
        } else {
            this.addDocAnnotation(childDocAnnotation);
        }

        this.reload();

    }

    private handleAnnotationEvent(id: string,
                                  mutationType: MutationType,
                                  docAnnotation: IDocAnnotation | undefined) {

        if (mutationType === MutationType.DELETE) {
            this.deleteDocAnnotation(id);
        } else {
            this.addDocAnnotation(docAnnotation!);
        }

        this.reload();

    }

    private deleteDocAnnotation(id: IDString) {
        this.docAnnotationIndex.delete(id);
        this.reload();
    }

    private addDocAnnotation(docAnnotation: IDocAnnotation) {
        this.docAnnotationIndex.put(docAnnotation);
        this.reload();
    }

    private reload() {

        const annotations = this.docAnnotationIndex.getDocAnnotationsSorted();

        this.setState({
            annotations
        });

    }

    private onExport(path: string, format: ExportFormat) {

        Exporters.doExport(path, format, this.props.doc.docMeta)
            .catch(err => log.error(err));

    }

    public render() {

        const persistenceLayer = this.props.persistenceLayerProvider();
        const capabilities = persistenceLayer.capabilities();

        const AnnotationHeader = () => {

            return (

                <div className="p-1 pb-2 mb-3 border-bottom pl-1 pr-1 text-md">

                    <SplitBar>

                        <SplitBarLeft>
                            <div style={{
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                 }}>
                                Annotations
                            </div>
                        </SplitBarLeft>

                        <SplitBarRight>

                            <ExportButton onExport={(path, format) => this.onExport(path, format)}/>

                            <GroupSharingButton doc={this.props.doc}
                                                datastoreCapabilities={capabilities}
                                                onDone={NULL_FUNCTION}/>

                        </SplitBarRight>


                    </SplitBar>

                </div>

            );

        };

        return (

            <div id="annotation-manager" className="annotation-sidebar">

                <AnnotationHeader/>

                <Annotations {...this.state} {...this.props}/>

            </div>

        );
    }

}

interface IProps {
    readonly doc: Doc;
    readonly persistenceLayerProvider: PersistenceLayerProvider;
}

interface IState {
    readonly annotations: ReadonlyArray<DocAnnotation>;
}

interface IRender extends IProps, IState {

}
