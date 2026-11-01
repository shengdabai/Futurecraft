// A small hook/element host for testing component state and event handlers.
// This deliberately does not implement a DOM or replace browser acceptance tests.
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';

export async function componentHost(entryPoint, exportName, api, initialProps) {
    const slots = [];
    const cleanups = [];
    let cursor = 0;
    let effects = [];
    let props = initialProps;
    let mounted = true;
    const host = {
        api,
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
            return [slots[index], value => {
                if (mounted) slots[index] = typeof value === 'function' ? value(slots[index]) : value;
            }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { current: initial };
            return slots[index];
        },
        useEffect(effect, dependencies) {
            const index = cursor++;
            const previous = slots[index];
            if (!previous || dependencies.some((value, i) => !Object.is(value, previous[i]))) {
                slots[index] = dependencies;
                effects.push(() => {
                    cleanups[index]?.();
                    cleanups[index] = effect();
                });
            }
        },
        createElement(type, elementProps, ...children) {
            return { type, props: { ...elementProps, children: children.flat(Infinity) } };
        },
    };
    const result = await build({
        entryPoints: [entryPoint], bundle: true, write: false, format: 'cjs', jsx: 'transform',
        tsconfigRaw: { compilerOptions: { jsx: 'react' } },
        plugins: [{
            name: 'component-dependencies',
            setup(builder) {
                builder.onResolve({ filter: /^(react|lucide-react)$|services\/apiService$/ }, args => ({ path: args.path, namespace: 'test' }));
                builder.onLoad({ filter: /.*/, namespace: 'test' }, args => {
                    if (args.path === 'react') return { contents: 'export const {useState,useEffect,useRef}=globalThis.host; export default {createElement: globalThis.host.createElement};' };
                    if (args.path === 'lucide-react') return { contents: 'export const Book="Book", Video="Video", Target="Target", Sword="Sword", ExternalLink="ExternalLink", Github="Github", Terminal="Terminal", ShieldAlert="ShieldAlert", ArrowRight="ArrowRight", Trophy="Trophy", Loader2="Loader2";' };
                    return { contents: 'export const {generateSkillTree,generateSimulationScenario,evaluateSimulationChoice}=globalThis.host.api;' };
                });
            },
        }],
    });
    const module = { exports: {} };
    runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, host });
    const Component = module.exports[exportName];
    return {
        render(nextProps = props) {
            props = nextProps;
            cursor = 0;
            effects = [];
            this.tree = Component(props);
            for (const effect of effects) effect();
            return this.tree;
        },
        async settle() {
            // Effects start requests; allow their promise continuations to update state.
            this.render();
            await setImmediate();
            return this.render();
        },
        unmount() {
            for (const cleanup of cleanups) cleanup?.();
            mounted = false;
        },
    };
}

export function elements(tree) {
    if (!tree || typeof tree !== 'object') return [];
    return [tree, ...(tree.props?.children ?? []).flatMap(elements)];
}

export function text(tree) {
    if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
    return (tree?.props?.children ?? []).map(text).join(' ');
}

export function button(tree, label) {
    return elements(tree).find(node => node.props?.onClick && text(node).includes(label));
}

export function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}
