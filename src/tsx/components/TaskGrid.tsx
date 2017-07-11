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
import Task, { TaskSpec } from "./Task";

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
const renderNavbar = (): JSX.Element => {
  return (<Navbar>
    <Navbar.Header>
      <Navbar.Brand>
        <a href="#">TaskLine</a>
      </Navbar.Brand>
    </Navbar.Header>
    <Navbar.Collapse>
      <Navbar.Form pullRight>
        <Task index={-1} poolIndex={-1} id={0}></Task>
      </Navbar.Form>
    </Navbar.Collapse>
  </Navbar>);
};

const calcSize = (
  pools: TPool[],
  taskId: number,
  poolIndex: number): number => {
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

const renderChildTasks = (
  grid: TaskGrid,
  pool: TPool,
  poolIndex: number,
  parentPool: TPool): JSX.Element[] => {
  
  const tasks: JSX.Element[] = [];
  let i = 0;
  let k = 0;
  parentPool.tasks.forEach(parentTask => {
    const filteredTasks = pool.tasks.filter(task => task.parentId === parentTask.id);
    if (filteredTasks.length > 0) {
      filteredTasks.forEach((task) => {
        tasks.push(
          <Task key={k}
            index={i}
            poolIndex={poolIndex}
            id={task.id}
            parentId={task.parentId}
            moveTask={grid.moveTask}
            size={calcSize(grid.state.pools, task.id, poolIndex)}>
            {task.content}
          </Task>
        );
        i++;
        k++;
      });
    }
    else { // dummy task (placeholder)
      tasks.push(
      <Task key={k}
        index={-1}
        poolIndex={poolIndex}
        id={-1}
        parentId={parentTask.id}
        moveTask={grid.moveTask}>
      </Task>
      );
      k++;
    }
  });
  return tasks;
};

const swapTasks = (
  pool: TPool,
  tSpec1: TaskSpec,
  tSpec2: TaskSpec): boolean => {
  const tasks: TTask[] = pool.tasks;
  const tIndex1: number = getIndex(pool, tSpec1);
  const tIndex2: number = getIndex(pool, tSpec2);
  if (tIndex1 === undefined || tIndex2 === undefined) { return false; }
  if (tSpec1.poolIndex === 0 || tSpec1.parentId === tSpec2.parentId) {
    [tasks[tIndex1], tasks[tIndex2]] = [tasks[tIndex2], tasks[tIndex1]];
  } else {
    [tasks[tIndex1].parentId, tasks[tIndex2].parentId] =
    [tasks[tIndex2].parentId, tasks[tIndex1].parentId];
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
  pool: TPool,
  tSpec: TaskSpec,
  id: number,
  position?: string | undefined): boolean => {
  const tasks: TTask[] = pool.tasks;
  const newTask: TTask = {
    id: id,
    content: "New Task"
  };
  if (tSpec.parentId) { newTask.parentId = tSpec.parentId; }
  if (position === undefined) { tasks.push(newTask); }
  else {
    let tIndexTo: number = getIndex(pool, tSpec);
    if (tIndexTo === undefined) { return false; }
    if (position === "right") { tIndexTo++; }
    tasks.splice(tIndexTo, 0, newTask);
  }
  return true;
};

const changeParentId = (
  pool: TPool,
  tSpec: TaskSpec,
  newId: number | TaskSpec): boolean => {
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

const getIndex = (pool: TPool, specId: TaskSpec | number): number | undefined => {
  const id = typeof specId === "number" ? specId : specId.id;
  const task: TTask = pool.tasks.filter(t => t.id === id)[0];
  if (task === undefined) { return undefined; }
  return pool.tasks.indexOf(task);
};

const moveUpTask = (
  pools: TPool[],
  tSpecFrom: TaskSpec,
  tSpecTo: TaskSpec,
  position: string | undefined) => {
  let diff: number = tSpecFrom.poolIndex - tSpecTo.poolIndex;
  const parentIndex = getIndex(pools[tSpecFrom.poolIndex], tSpecFrom.id);
  let tIndexTo = getIndex(pools[tSpecTo.poolIndex], tSpecTo.id);
  let pIndexTo = tSpecTo.poolIndex;
  const parentTask = pools[tSpecFrom.poolIndex].tasks.splice(parentIndex, 1)[0];
  if (position === undefined) {
    diff--;
    pIndexTo++;
    parentTask.parentId = tSpecTo.id;
  }
  else if (position === "right") { tIndexTo++; }
  pools[pIndexTo].tasks.splice(tIndexTo, 0, parentTask);
  moveUpChildTasks(pools, tSpecFrom.poolIndex, tSpecFrom.id, diff);
};

const moveUpChildTasks = (
  pools: TPool[],
  poolIndex: number,
  taskId: number,
  diff: number) => {
  if (pools[poolIndex + 1] === undefined) { return; }
  const childIds = getChildIds(pools[poolIndex+1], taskId);
  for (let c in childIds) {
    moveUpChildTasks(pools, poolIndex + 1, childIds[c], diff);
    let childIndex = getIndex(pools[poolIndex + 1], childIds[c]);
    let childTask = pools[poolIndex + 1].tasks.splice(childIndex, 1)[0];
    pools[poolIndex + 1 - diff].tasks.push(childTask);
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

const getMaxId = (pools: TPool[]): number => {
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

/* CLASS */
@DragDropContext(HTML5Backend)
export default class TaskGrid extends React.Component<P, S> {
  constructor() {
    super();
    this.moveTask = this.moveTask.bind(this);
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
        }
      ]
    };
  }

  moveTask?(dTaskSpec: TaskSpec, hTaskSpec: TaskSpec, position?: string | undefined) {
    const newPools = this.state.pools.slice();
    const hPool: TPool = newPools[hTaskSpec.poolIndex];
    const dPool: TPool = newPools[dTaskSpec.poolIndex];
    // TODO: This section require more unify and removing `position` condition
    if (position) {
      if (dTaskSpec.id === 0) {
        insertNewTask(hPool, hTaskSpec, getMaxId(newPools) + 1, position);
      }
      else if (hPool === dPool) {
        insertTask(hPool, dTaskSpec, hTaskSpec, position);
      } else if (hTaskSpec.poolIndex < dTaskSpec.poolIndex) { // up
        moveUpTask(newPools, dTaskSpec, hTaskSpec, position);
      } else {
        // TODO: Add logic to move tasks between many pools
      }
    } else {
      if (dTaskSpec.id === 0) {
        insertNewTask(hPool, hTaskSpec, getMaxId(newPools) + 1);
      }
      else if (hPool === dPool) {
        if (hTaskSpec.id > 0) { // normal task
          swapTasks(dPool, dTaskSpec, hTaskSpec);
        } else { // dummy task
          changeParentId(dPool, dTaskSpec, hTaskSpec.parentId);
        }
      } else if (hTaskSpec.poolIndex === dTaskSpec.poolIndex - 1) {
        changeParentId(dPool, dTaskSpec, hTaskSpec);
      } else if (hTaskSpec.poolIndex < dTaskSpec.poolIndex) { // up
        moveUpTask(newPools, dTaskSpec, hTaskSpec, position);
      } else {
        // TODO: Add logic to move tasks between many pools
      }
    }
    this.setState({ pools: newPools });
  }

  render(): JSX.Element | null | false {
    const pools = this.state.pools.slice();
    return (
      <div>
        {renderNavbar()}
        {pools.map((pool, i) => (
          <Pool key={i}>
            {i === 0 ?
              (pool.tasks.map((task, j) => (
                <Task key={j}
                  index={j}
                  poolIndex={i}
                  id={task.id}
                  moveTask={this.moveTask}
                  size={calcSize(pools, task.id, i)}>
                  {task.content}
                </Task>))) :
              renderChildTasks(this, pool, i, this.state.pools[i - 1])}
          </Pool>
        ))}
        <Pool>{JSON.stringify(this.state, null, 4)}</Pool>
      </div>
    );
  }
}