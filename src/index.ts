import { useState, useEffect } from 'react';

const run = Symbol();

type Model = { [key: string]: any; [run]?: { keys: string[]; setModel: SetModel }[] };
type SetLoading = (model: Model, key: string, loading: boolean) => void;
type SetModel = (payload: Model) => void;
type UseModel = (model: Model, keys?: string[]) => Model;

const MIS_USE = (): string => 'Please call setModel() inside a model';
const NOT_OBJ = (key: string) => `${key} should be an object`;
const NOT_ARR = (key: string) => `${key} should be an array`;
const notObj = (val: any): boolean => Object.prototype.toString.call(val) !== '[object Object]';

const map: WeakMap<Model, Model> = new WeakMap();
const stack: Model[] = [];

const setLoading: SetLoading = (model, key, loading) => {
  model[key].loading = loading;
  setModel({ [key]: model[key] });
};

export const setModel: SetModel = (payload) => {
  const currentModel = stack[0];
  if (process.env.NODE_ENV !== 'production') {
    if (!currentModel) throw new Error(MIS_USE());
    if (notObj(payload)) throw new Error(NOT_OBJ('payload'));
  }

  Object.assign(currentModel, payload);
  const subs = currentModel[run] || [];
  const updateKeys = Object.keys(payload);
  subs.forEach(({ keys, setModel }) => {
    if (updateKeys.some((key) => keys.includes(key))) setModel(payload);
  });
};

export const useModel: UseModel = (model, keys) => {
  if (process.env.NODE_ENV !== 'production') {
    if (notObj(model)) throw new Error(NOT_OBJ('model'));
    if (keys !== undefined && !Array.isArray(keys)) throw new Error(NOT_ARR('keys'));
  }

  if (map.get(model) === undefined) {
    Object.setPrototypeOf(model, Object.defineProperty({}, run, { value: [] }));
    Object.keys(model).forEach((key) => {
      const val = model[key];
      if (typeof val !== 'function') return;
      model[key] = (...args: any) => {
        stack.unshift(model);
        const res = val(...args);
        if (!res || typeof res.then !== 'function') {
          stack.shift();
          return res;
        }
        return new Promise((resolve, reject) => {
          setLoading(model, key, true);
          const pro = res.then(resolve).catch(reject);
          pro.finally(() => {
            setLoading(model, key, false);
            stack.shift();
          });
        });
      };
    });
    map.set(model, model);
  }

  const [, setState] = useState();

  useEffect(() => {
    if (keys === undefined) keys = Object.keys(model);
    if (keys.length === 0) return;
    const subs = model[run] || [];
    const item = { keys, setModel: setState };
    subs.push(item);
    return () => {
      subs.splice(subs.indexOf(item), 1);
    };
  }, []);

  return model;
};
