import assert from 'node:assert/strict';
import { test } from 'node:test';
import { button, componentHost, deferred, elements, text } from './component-host.mjs';

const job = { id: 'dev', title: 'Developer' };
const resource = { id: 'book', title: 'Learn JavaScript', type: 'Book', description: 'Fundamentals', xp: 100 };
const scenario = { scenario: 'A deadline is approaching.', options: [{ id: 'A', text: 'Ask for help' }] };
const outcome = { outcome: 'SURVIVED', score: 80, feedback: 'Good teamwork.' };
const resourceProps = { job, language: 'zh', onStartTutor() {} };
const simulationProps = { job, language: 'zh', onComplete() {} };

test('skill tree failure shows an error and allows a successful retry', async () => {
    let calls = 0;
    const host = await componentHost('components/ResourceView.tsx', 'ResourceView', {
        generateSkillTree: async () => { if (++calls === 1) throw new Error('offline'); return [resource]; },
    }, resourceProps);
    await host.settle();
    assert.ok(elements(host.tree).some(node => node.props?.role === 'alert'));
    assert.equal(button(host.tree, '激活 AI 导师'), undefined);
    button(host.tree, '重试').props.onClick();
    await host.settle();
    assert.ok(text(host.tree).includes(resource.title));
    assert.ok(button(host.tree, '激活 AI 导师'));
    assert.equal(calls, 2);
    host.unmount();
});

test('an empty skill tree offers retry instead of activating an empty tutor', async () => {
    const host = await componentHost('components/ResourceView.tsx', 'ResourceView', {
        generateSkillTree: async () => [],
    }, resourceProps);
    await host.settle();
    assert.ok(button(host.tree, '重试'));
    assert.equal(button(host.tree, '激活 AI 导师'), undefined);
    host.unmount();
});

test('changing language enters loading state and ignores a stale request', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    const calls = [];
    const host = await componentHost('components/ResourceView.tsx', 'ResourceView', {
        generateSkillTree: (title, language) => { calls.push([title, language]); return language === 'zh' ? oldRequest.promise : newRequest.promise; },
    }, resourceProps);
    host.render();
    host.render({ ...resourceProps, language: 'en' });
    assert.ok(text(host.render()).includes('Generating Skill Tree'));
    newRequest.resolve([{ ...resource, title: 'English resource' }]);
    await host.settle();
    oldRequest.resolve([{ ...resource, title: 'Stale resource' }]);
    await host.settle();
    assert.ok(text(host.tree).includes('English resource'));
    assert.equal(text(host.tree).includes('Stale resource'), false);
    assert.deepEqual(calls, [['Developer', 'zh'], ['Developer', 'en']]);
    host.unmount();
});

test('recreating an equivalent job object does not regenerate the skill tree', async () => {
    let calls = 0;
    const host = await componentHost('components/ResourceView.tsx', 'ResourceView', {
        generateSkillTree: async () => { calls++; return [resource]; },
    }, resourceProps);
    await host.settle();
    host.render({ ...resourceProps, job: { ...job } });
    await host.settle();
    assert.equal(calls, 1);
    host.unmount();
});

test('a rejected obsolete skill-tree request does not replace a successful new tree', async () => {
    const oldRequest = deferred();
    const host = await componentHost('components/ResourceView.tsx', 'ResourceView', {
        generateSkillTree: (_title, language) => language === 'zh' ? oldRequest.promise : Promise.resolve([resource]),
    }, resourceProps);
    host.render();
    host.render({ ...resourceProps, language: 'en' });
    await host.settle();
    oldRequest.reject(new Error('old request failed'));
    await host.settle();
    assert.ok(button(host.tree, 'Activate AI Tutor'));
    assert.equal(elements(host.tree).some(node => node.props?.role === 'alert'), false);
    host.unmount();
});

test('simulation generation failure stays on intro and retry can load the scenario', async () => {
    let calls = 0;
    const host = await componentHost('components/SimulationView.tsx', 'SimulationView', {
        generateSimulationScenario: async () => { if (++calls === 1) throw new Error('offline'); return scenario; },
    }, simulationProps);
    host.render();
    await button(host.render(), '开始体验').props.onClick();
    assert.ok(elements(host.render()).some(node => node.props?.role === 'alert'));
    await button(host.tree, '开始体验').props.onClick();
    assert.ok(text(host.render()).includes(scenario.scenario));
    host.unmount();
});

test('simulation evaluation failure retains the options and supports retry', async () => {
    let calls = 0;
    const host = await componentHost('components/SimulationView.tsx', 'SimulationView', {
        generateSimulationScenario: async () => scenario,
        evaluateSimulationChoice: async () => { if (++calls === 1) throw new Error('offline'); return outcome; },
    }, simulationProps);
    host.render();
    await button(host.render(), '开始体验').props.onClick();
    await button(host.render(), 'Ask for help').props.onClick();
    assert.ok(elements(host.render()).some(node => node.props?.role === 'alert'));
    await button(host.tree, 'Ask for help').props.onClick();
    assert.ok(text(host.render()).includes(outcome.feedback));
    host.unmount();
});

test('changing simulation language discards a pending scenario response', async () => {
    const request = deferred();
    const host = await componentHost('components/SimulationView.tsx', 'SimulationView', {
        generateSimulationScenario: () => request.promise,
    }, simulationProps);
    host.render();
    const pending = button(host.render(), '开始体验').props.onClick();
    host.render({ ...simulationProps, language: 'en' });
    request.resolve(scenario);
    await pending;
    assert.ok(button(host.render(), 'Start Simulation'));
    assert.equal(text(host.tree).includes(scenario.scenario), false);
    host.unmount();
});

test('repeated simulation clicks share one pending generation request', async () => {
    const request = deferred();
    let calls = 0;
    const host = await componentHost('components/SimulationView.tsx', 'SimulationView', {
        generateSimulationScenario: () => { calls++; return request.promise; },
    }, simulationProps);
    host.render();
    const start = button(host.render(), '开始体验').props.onClick;
    const first = start();
    const second = start();
    assert.equal(calls, 1);
    request.resolve(scenario);
    await Promise.all([first, second]);
    assert.ok(text(host.render()).includes(scenario.scenario));
    host.unmount();
});

test('a rejected simulation request after unmount is handled', async () => {
    const request = deferred();
    const host = await componentHost('components/SimulationView.tsx', 'SimulationView', {
        generateSimulationScenario: () => request.promise,
    }, simulationProps);
    host.render();
    const pending = button(host.render(), '开始体验').props.onClick();
    host.unmount();
    request.reject(new Error('request ended after leaving'));
    await assert.doesNotReject(pending);
});

test('a successful skill tree forwards its resources to the tutor', async () => {
    let selected;
    const host = await componentHost('components/ResourceView.tsx', 'ResourceView', {
        generateSkillTree: async () => [resource],
    }, { ...resourceProps, onStartTutor: value => { selected = value; } });
    await host.settle();
    button(host.tree, '激活 AI 导师').props.onClick();
    assert.equal(selected[0], resource);
    host.unmount();
});

test('late evaluation results cannot overwrite a new simulation', async () => {
    const evaluation = deferred();
    const nextScenario = deferred();
    const host = await componentHost('components/SimulationView.tsx', 'SimulationView', {
        generateSimulationScenario: (_title, language) => language === 'zh' ? Promise.resolve(scenario) : nextScenario.promise,
        evaluateSimulationChoice: () => evaluation.promise,
    }, simulationProps);
    host.render();
    await button(host.render(), '开始体验').props.onClick();
    const pending = button(host.render(), 'Ask for help').props.onClick();
    host.render({ ...simulationProps, language: 'en' });
    const next = button(host.render(), 'Start Simulation').props.onClick();
    evaluation.resolve(outcome);
    await pending;
    assert.equal(button(host.render(), 'Start Simulation').props.isLoading, true);
    nextScenario.resolve({ ...scenario, scenario: 'New scenario' });
    await next;
    assert.ok(text(host.render()).includes('New scenario'));
    assert.equal(text(host.tree).includes(outcome.feedback), false);
    host.unmount();
});
