import {Rnd} from "react-rnd";
import * as React from "react";
import {useState} from "react";
import {ILTRect} from "polar-shared/src/util/rects/ILTRect";
import {NULL_FUNCTION} from "polar-shared/src/util/Functions";
import {Dictionaries} from "polar-shared/src/util/Dictionaries";
import {deepMemo} from "../../../../web/js/react/ReactUtils";

interface IProps {
    readonly id?: string;
    readonly style?: React.CSSProperties;
    readonly resizeHandleStyle?: React.CSSProperties;

    readonly className?: string;

    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;

    readonly onResized?: (resizeRect: ILTRect) => void;

    readonly onContextMenu?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;

}

interface IState {
    readonly active: boolean;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export const ResizeBox = deepMemo((props: IProps) => {

    const [state, setState] = useState<IState>({
        active: true,
        x: props.left,
        y: props.top,
        width: props.width,
        height: props.height
    });

    // force pointer events on the resize corners.
    const resizeHandleStyle: React.CSSProperties = {
        pointerEvents: 'auto',
        ...(props.resizeHandleStyle || {})
    };

    const handleOnMouseOver = () => {
        setState({
            ...state,
            active: true
        });
    }

    const handleOnMouseOut = () => {
        setState({
            ...state,
            active: false
        });
    }

    const handleResize = React.useCallback((state: IState) => {

        setState(state);

        try {

            // It's important to always catch exceptions here as if we don't
            // then react-rnd breaks.

            const onResized = props.onResized || NULL_FUNCTION

            onResized({
                left: state.x,
                top: state.y,
                width: state.width,
                height: state.height
            });

        } catch (e) {
            console.error(e);
        }

    }, [])

    const dataProps = Dictionaries.filter<any>(props, key => key.startsWith('data-'));

    const resizeStyles = {
        vertical: {
            width: '5px'
        },
        horizontal: {
            height: '5px'
        },
        corner: {
            width: '5px',
            height: '5px'
        }
    }

    return (
        <>

            {/*{state.active &&*/}
            {/*    <ControlBar bottom={state.y} left={state.x} width={state.width}/>}*/}

            <Rnd
                id={props.id}
                bounds="parent"
                className={props.className}
                size={{
                    width: state.width,
                    height: state.height
                }}
                position={{ x: state.x, y: state.y }}
                // onMouseOver={() => handleOnMouseOver()}
                // onMouseOut={() => handleOnMouseOut()}
                onDragStop={(e, d) => {
                    handleResize({
                        ...state,
                        x: d.x,
                        y: d.y
                    });
                }}
                onResizeStop={(e,
                               direction,
                               ref,
                               delta,
                               position) => {

                    const width = parseInt(ref.style.width);
                    const height = parseInt(ref.style.height);

                    handleResize({
                        ...state,
                        width,
                        height,
                        ...position,
                    });

                }}
                disableDragging={true}
                resizeHandleStyles={{
                    top: {
                        ...resizeHandleStyle,
                        ...resizeStyles.horizontal
                    },
                    bottom: {
                        ...resizeHandleStyle,
                        ...resizeStyles.horizontal
                    },
                    left: {
                        ...resizeHandleStyle,
                        ...resizeStyles.vertical
                    },
                    right: {
                        ...resizeHandleStyle,
                        ...resizeStyles.vertical
                    },
                    topLeft: {
                        ...resizeHandleStyle,
                        ...resizeStyles.corner,
                        top: '-5px',
                        left: '-5px'
                    },
                    topRight: {
                        ...resizeHandleStyle,
                        ...resizeStyles.corner,
                        top: '-5px',
                        right: '-5px'
                    },
                    bottomLeft: {
                        ...resizeHandleStyle,
                        ...resizeStyles.corner,
                        bottom: '-5px',
                        left: '-5px'
                    },
                    bottomRight: {
                        ...resizeHandleStyle,
                        ...resizeStyles.corner,
                        bottom: '-5px',
                        right: '-5px'
                    },
                }}
                style={{
                    ...props.style,
                    pointerEvents: 'none',
                }}
                {...dataProps}>
                {/*<div onContextMenu={props.onContextMenu}*/}
                {/*     style={{*/}
                {/*         width: state.width,*/}
                {/*         height: state.height*/}
                {/*     }}>*/}

                {/*</div>*/}
            </Rnd>
        </>
    );

})
