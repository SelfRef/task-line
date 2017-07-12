/* IMPORTS */
import * as React from "react";
import {
  Grid,
  Row,
  Col,
  Navbar,
  Nav,
  NavItem,
  Button,
  ButtonToolbar
} from "react-bootstrap";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";

import Pool from "./Pool";
import Task, { TaskSpec, PoolView, TaskView } from "./Task";

/* INTERFACES */
interface TTask {
  id: number;
  parentId?: number;
  content: string;
}
interface TPool {
  id: number;
  tasks: TTask[];
}

interface P { 
  calcSize?: (taskId: number, poolIndex: number) => number;
}
interface S {
  pools: TPool[];
}

/* METHODS */
const renderNavbar = (
  moveTask: (dragTask: TaskSpec, hoverTask: TaskSpec, position?: string | undefined) => void): JSX.Element => {
  return (<Navbar fluid>
    <Navbar.Header>
      <Navbar.Brand>
        <a href="#">TaskLine</a>
      </Navbar.Brand>
    </Navbar.Header>
    <Navbar.Collapse>
      <Navbar.Form pullRight>
        <Task poolIndex={-1} id={0} moveTask={moveTask}></Task>
      </Navbar.Form>
    </Navbar.Collapse>
  </Navbar>);
};

const calcSize = (
  pools: TPool[], taskId: number, poolIndex: number): number => {
  let count = 1;
  if (taskId === -1 || pools[poolIndex+1] === undefined) { return count; }
  for (let p = poolIndex+1; p < pools.length; p++) {
    let childIds = getChildIds(pools[p], taskId);
    if (childIds.length > 1) { count += childIds.length - 1; }
    for (let i in childIds) {
      let childsCount = calcSize(pools, childIds[i], poolIndex + 1);
      if (childsCount > 1) { count += childsCount - 1; }
    }
  }
  return count;
};

const poolViews = (
  pools: TPool[]): PoolView[] => {
  const elems: PoolView[] = pools.map((pool, i) => {
    return { key: i, id: pool.id, tasks: [] };
  });
  elems[0].tasks = pools[0].tasks.map((task, i) => {
    return {
      key: i,
      poolIndex: 0,
      id: task.id,
      size: calcSize(pools, task.id, 0),
      content: task.content
    };
  });
  for (let mt in elems[0].tasks) {
    addChildTaskViews(elems, pools, 0, parseInt(mt));
  }
  return elems;
};

const addChildTaskViews = (
  poolViews: PoolView[],
  pools: TPool[],
  poolIndex: number,
  taskIndex: number) => {
  if (poolViews[poolIndex + 1] === undefined) { return; }
  const currentTask = poolViews[poolIndex].tasks[taskIndex];
  const childTaskViews = poolViews[poolIndex + 1].tasks;
  const childTasks: TTask[] = pools[poolIndex + 1].tasks
    .filter((task) => task.parentId === currentTask.id);
  if (currentTask.id > 0 && childTasks.length > 0) {
    for (let ct in childTasks) {
      const index = childTaskViews.length;
      childTaskViews.push({
        key: index,
        poolIndex: poolIndex + 1,
        id: childTasks[ct].id,
        parentId: childTasks[ct].parentId,
        size: calcSize(pools, childTasks[ct].id, poolIndex + 1),
        content: childTasks[ct].content
      });
      addChildTaskViews(poolViews, pools, poolIndex + 1, index);
    }
  }
  else {
    const index = childTaskViews.length;
    childTaskViews.push({
      key: index,
      poolIndex: poolIndex + 1,
      id: currentTask.id < 0 ? -2 : -1,
      parentId: currentTask.id < 0 ? undefined : currentTask.id,
      size: 1
    });
    addChildTaskViews(poolViews, pools, poolIndex + 1, index);
  }
};

/* old render method
const renderChildTasks = (
  grid: TaskGrid,
  pools: TPool[],
  poolIndex: number): JSX.Element[] => {
  const currentTasks = pools[poolIndex].tasks;
  const parentTasks = pools[poolIndex - 1].tasks;
  const tasks: JSX.Element[] = [];
  let k = 0;
  let pk = 0;
  for (let p in parentTasks) {
    let childTasks = currentTasks.filter(task =>
      task.parentId === parentTasks[p].id);
    if (grid.placeholders.filter(t => t.poolIndex === poolIndex - 1 &&
      t.id === pk).length > 0) {
      tasks.push(
        <Task key={k}
          poolIndex={poolIndex}
          id={-2}
          parentId={null}
          moveTask={grid.moveTask}>
        </Task>);
      grid.placeholders.push({
        id: k,
        parentId: null,
        poolIndex: poolIndex
      });
      k++;
    }
    if (childTasks.length === 0) {
      tasks.push(
        <Task key={k}
          poolIndex={poolIndex}
          id={-1}
          parentId={parentTasks[p].id}
          moveTask={grid.moveTask}>
        </Task>);
      grid.placeholders.push({
        id: k,
        parentId: parentTasks[p].id,
        poolIndex: poolIndex
      });
      k++;
    }
    else {
      for (let c in childTasks) {
        tasks.push(
          <Task key={k}
            poolIndex={poolIndex}
            id={childTasks[c].id}
            parentId={parentTasks[p].id}
            moveTask={grid.moveTask}
            size={calcSize(grid.state.pools, childTasks[c].id, poolIndex)}>
            {childTasks[c].content}
          </Task>);
        k++;
      }
    }
    pk++;
  }
  return tasks;
}; */

const swapTasks = (
  pools: TPool[], tSpec1: TaskSpec, tSpec2: TaskSpec): boolean => {
  const tasks1: TTask[] = pools[tSpec1.poolIndex].tasks;
  const tasks2: TTask[] = pools[tSpec2.poolIndex].tasks;
  const tIndex1: number = getIndex(pools[tSpec1.poolIndex], tSpec1);
  const tIndex2: number = getIndex(pools[tSpec2.poolIndex], tSpec2);
  if (tIndex1 === undefined || tIndex2 === undefined) { return false; }
  if (tSpec1.poolIndex === tSpec2.poolIndex) {
    if (tSpec1.poolIndex === 0 || tSpec1.parentId === tSpec2.parentId) {
      [tasks1[tIndex1], tasks2[tIndex2]] = [tasks2[tIndex2], tasks1[tIndex1]];
    } else {
      [tasks1[tIndex1].parentId, tasks2[tIndex2].parentId] =
      [tasks2[tIndex2].parentId, tasks1[tIndex1].parentId];
    }
  } else {
    return false; // TODO: Maybe move implementation here
  }
  return true;
};

const insertTask = (
  pool: TPool,
  tSpecFrom: TaskSpec,
  tSpecTo: TaskSpec,
  position: string | undefined): boolean => {
  const tasks: TTask[] = pool.tasks;
  const tIndexFrom: number = getIndex(pool, tSpecFrom);
  const taskToMove: TTask = tasks.splice(tIndexFrom, 1)[0];
  let tIndexTo: number = getIndex(pool, tSpecTo);
  if (tIndexFrom === undefined || tIndexTo === undefined) { return false; }
  if (position === "right") { tIndexTo++; }
  tasks.splice(tIndexTo, 0, taskToMove);
  if (tSpecFrom.parentId !== tSpecTo.parentId) {
    tasks[tIndexTo].parentId = tSpecTo.parentId;
  }
  return true;
};

const insertNewTask = (
  pools: TPool[],
  tSpec: TaskSpec,
  id: number,
  position?: string | undefined): boolean => {
  const newTask: TTask = {
    id: id,
    content: "New Task"
  };
  if (position === undefined) {
    if (tSpec.id < 0) {
      newTask.parentId = tSpec.parentId;
      pools[tSpec.poolIndex].tasks.push(newTask);
    } else {
      newTask.parentId = tSpec.id;
      pools[checkPool(pools, tSpec.poolIndex+1)].tasks.push(newTask);
    }
  }
  else {
    if (tSpec.parentId) { newTask.parentId = tSpec.parentId; }
    let tIndexTo: number = getIndex(pools[tSpec.poolIndex], tSpec);
    if (tIndexTo === undefined) { return false; }
    if (position === "right") { tIndexTo++; }
    pools[tSpec.poolIndex].tasks.splice(tIndexTo, 0, newTask);
  }
  return true;
};

const changeParentId = (
  pool: TPool, tSpec: TaskSpec, newId: number | TaskSpec): boolean => {
  const tasks: TTask[] = pool.tasks;
  const task: TTask = tasks.filter(t => t.id === tSpec.id)[0];
  if (task === undefined) { return false; }
  const tIndex: number = tasks.indexOf(task);
  if (typeof newId === "number") {
    tasks[tIndex].parentId = newId;
  } else {
    tasks[tIndex].parentId = newId.id;
  }
  return true;
};

const getIndex = (
  pool: TPool, specId: TaskSpec | number): number | undefined => {
  const id = typeof specId === "number" ? specId : specId.id;
  const task: TTask = pool.tasks.filter(t => t.id === id)[0];
  if (task === undefined) { return undefined; }
  return pool.tasks.indexOf(task);
};

const moveVertTask = (
  pools: TPool[],
  tSpecFrom: TaskSpec,
  tSpecTo: TaskSpec,
  position: string | undefined) => {
  const parentIndex = getIndex(pools[tSpecFrom.poolIndex], tSpecFrom.id);
  const parentTask = pools[tSpecFrom.poolIndex].tasks.splice(parentIndex, 1)[0];
  let diff: number = tSpecFrom.poolIndex - tSpecTo.poolIndex;
  if (tSpecTo.id === -1) {
    parentTask.parentId = tSpecTo.parentId;
    pools[tSpecTo.poolIndex].tasks.push(parentTask);
    moveVertChildTasks(pools, tSpecFrom.poolIndex, tSpecFrom.id, diff);
    removeEmptyPools(pools);
    return;
  }
  let tIndexTo = getIndex(pools[tSpecTo.poolIndex], tSpecTo.id);
  let pIndexTo = tSpecTo.poolIndex;
  if (position === undefined) {
    parentTask.parentId = tSpecTo.id;
    diff--;
    pIndexTo++;
  }
  else {
    parentTask.parentId = tSpecTo.parentId;
    if (position === "right") { tIndexTo++; }
  }
  pools[checkPool(pools, pIndexTo)].tasks.splice(tIndexTo, 0, parentTask);
  moveVertChildTasks(pools, tSpecFrom.poolIndex, tSpecFrom.id, diff);
  removeEmptyPools(pools);
};

const moveVertChildTasks = (
  pools: TPool[],
  poolIndex: number,
  taskId: number,
  diff: number) => {
  if (pools[poolIndex + 1] === undefined) { return; }
  const childIds = getChildIds(pools[poolIndex+1], taskId);
  for (let c in childIds) {
    moveVertChildTasks(pools, poolIndex + 1, childIds[c], diff);
    let childIndex = getIndex(pools[poolIndex + 1], childIds[c]);
    let childTask = pools[poolIndex + 1].tasks.splice(childIndex, 1)[0];
    pools[checkPool(pools, poolIndex + 1 - diff)].tasks.push(childTask);
  }
};

const getChildIds = (pool: TPool, specId: TaskSpec | number): number[] => {
  const id = typeof specId === "number" ? specId : specId.id;
  let ids: number[] = [];
  for (let t in pool.tasks) {
    if (pool.tasks[t].parentId === id) {
      ids.push(pool.tasks[t].id);
    }
  }
  return ids;
};

const getMaxTaskId = (pools: TPool[]): number => {
  let maxId = 0;
  for (let p in pools) {
    for (let t in pools[p].tasks) {
      if (pools[p].tasks[t].id > maxId) {
        maxId = pools[p].tasks[t].id;
      }
    }
  }
  return maxId;
};

const checkPool = (pools: TPool[], poolIndex: number): number => {
  for (let i = pools.length - 1; i <= poolIndex; i++) {
    if (pools[poolIndex] === undefined) {
      let maxId = poolIndex;
      for (let p in pools) {
        if (pools[p].id > maxId) { maxId = pools[p].id; }
      }
      const newPool: TPool = { id: maxId + 1, tasks: [] };
      pools.push(newPool);
    }
  }
  return poolIndex;
};

const removeChilds = (pools: TPool[], poolIndex: number, taskId: number) => {
  for (let p = poolIndex + 1; p < pools.length; p++) {
    const childPool: TPool = pools[poolIndex + 1];
    let childTasks = childPool.tasks
      .filter(t => t.parentId === taskId);
    for (let c in childTasks) {
      let index = getIndex(childPool, childTasks[c].id);
      childPool.tasks.splice(index, 1);
      removeChilds(pools, poolIndex + 1, childTasks[c].id);
    }
  }
  removeEmptyPools(pools);
};

const removeEmptyPools = (pools: TPool[]) => {
  for (let p = pools.length - 1; p > 0; p--) {
    if (pools[p].tasks.length === 0) { pools.splice(p, 1); }
  }
};

/* CLASS */
@DragDropContext(HTML5Backend)
export default class TaskGrid extends React.Component<P, S> {
  placeholders?: TaskSpec[];
  constructor() {
    super();
    this.placeholders = [];
    this.moveTask = this.moveTask.bind(this);
    this.addSinglePool = this.addSinglePool.bind(this);
    this.state = {
      pools: [ // sample data
        {
          id: 1,
          tasks: [
            { id: 1, content: "Task 1" },
            { id: 2, content: "Task 2" },
            { id: 3, content: "Task 3" },
            { id: 4, content: "Task 4" },
          ]
        },
        {
          id: 2,
          tasks: [
            { id: 5, parentId: 1, content: "Task 5" },
            { id: 6, parentId: 1, content: "Task 6" },
            { id: 7, parentId: 4, content: "Task 7" },
            { id: 8, parentId: 3, content: "Task 8" },
          ]
        },
        {
          id: 3,
          tasks: [
            { id: 9, parentId: 5, content: "Task 9" },
            { id: 10, parentId: 5, content: "Task 10" }
          ]
        }
      ]
    };
  }

  moveTask?(
    dTaskSpec: TaskSpec, hTaskSpec: TaskSpec, position?: string | undefined) {
    const newPools = this.state.pools.slice();
    const hPool: TPool = newPools[hTaskSpec.poolIndex];
    const dPool: TPool = newPools[dTaskSpec.poolIndex];

    if (hTaskSpec.id === 0) {
      dPool.tasks.splice(getIndex(dPool, dTaskSpec), 1);
      removeChilds(newPools, dTaskSpec.poolIndex, dTaskSpec.id);
    } else if (dTaskSpec.id === 0) {
      insertNewTask(newPools, hTaskSpec, getMaxTaskId(newPools) + 1, position);
    }
    else if (hPool === dPool) {
      if (position) { insertTask(hPool, dTaskSpec, hTaskSpec, position); }
      else {
        if (hTaskSpec.id > 0) {
          swapTasks(newPools, dTaskSpec, hTaskSpec);
        } else {
          changeParentId(dPool, dTaskSpec, hTaskSpec.parentId);
        }
      }
    } else {
      moveVertTask(newPools, dTaskSpec, hTaskSpec, position);
    }
    this.setState({ pools: newPools });
  }

  addSinglePool?() {
    const pools = this.state.pools;
    pools.push({ id: pools.length, tasks: [] });
    this.setState({ pools });
  }

  render(): JSX.Element | null | false {
    const pools = this.state.pools.slice();
    return (
      <Grid fluid><Row style={{display: "flex"}}>
        <Col style={{flexGrow: 1}}>
          {renderNavbar(this.moveTask)}
          {poolViews(pools).map(p => (
            <Pool key={p.key} id={p.id}>
              {p.tasks.map(t => (
                <Task
                  key={t.key}
                  poolIndex={t.poolIndex}
                  id={t.id}
                  parentId={t.parentId}
                  size={t.size}
                  moveTask={this.moveTask}>
                {t.content}</Task>
              ))}
            </Pool>
          ))}
          <Button block onClick={this.addSinglePool}>Add pool</Button>
        </Col>
        <Col style={{whiteSpace: "pre", fontFamily: "monospace"}}>
          {JSON.stringify(this.state, null, 1)}
        </Col>
      </Row></Grid>
    );
  }
}