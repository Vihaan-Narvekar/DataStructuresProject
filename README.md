# AVL vs Binary Tree when Storing Stock Prices

Build an ordinary binary search tree and an AVL tree from the same stock prices. Replay the keys in different orders, predict search costs, and repair an AVL imbalance with a rotation.

[Open the live site on GitHub Pages](https://vihaan-narvekar.github.io/DataStructuresProject/).

## Run locally

Open [`docs/index.html`](docs/index.html) in your browser. The bundled script is included, so the lesson can run directly from the file.

To preview over HTTP instead, run this from the project directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open [the local lesson](http://127.0.0.1:8000/). All prices and results are processed in the browser. A run can contain up to 64 unique prices.

## Run the guided lesson

1. Select **Run the rally**. Both trees insert $100, $101, and $102, then pause at the first AVL imbalance. Select **View the repair** to inspect it, **Step through repair** to apply just the rotation, or **Play** to repair the tree and continue through $107.
2. Select **Predict $107** and submit the search. Watch the comparison counters advance as the two trees visit their nodes.
3. Select **Replay with a different order**. The same eight keys are inserted in a fixed alternate order, then the lesson searches for $107 again. Use **Compare results** to see both runs together. Click or tap the growth chart, or move its slider, to inspect the same insertion in both runs.
4. Select **Review subtree transfer** to see what happens to the branch rooted at $102 after the sixth rally insertion. Add `?preview=3d` to the lesson URL to enable **3D preview**. Drag or use the arrow controls to orbit, zoom with **−** and **+**, and select a node to see its balance factor, parent, and children. **Next frame** keeps your viewing angle and updates the selected node as the tree rotates.

## Try your own prices

- Insert prices one at a time, or use **Customize sequence** to paste prices or generate them with a start, increment, and count. Preview the values, choose an insertion order, and select **Replay this order**. Use **Step**, **Play**, **Pause**, or **Undo** to control the sequence.
- Enter a target or choose **Use a deepest BST key**. Compare search paths and expand **Show exact heights and search counts** for the measurements after each insertion.
- Open **Practice a rotation** after a run triggers an imbalance. Drag a child onto its parent or select a pivot and use the rotation buttons. Use **Undo move** and **Retry** to explore.

In the comparison panels, use the arrow buttons or Shift + arrow keys to move a selected node. **Fit** adjusts the zoom for deeper trees. **How it works** includes an option to reduce animations.

## Run tests

With Node.js installed, run:

```sh
npm test
```

The tests exercise exact-cent parsing, sequence replay, both guided search paths, the guided rotation and subtree transfer, undo, all four AVL rotation cases, and the rotation practice model. See the [iteration plan](ITERATION_PLAN.md#implementation-order-and-verification) for the browser and classmate walkthroughs.

After editing a module in `docs/js/`, regenerate the browser bundle:

```sh
npm ci
npm run build
```

## GitHub Pages handoff

GitHub Pages serves `docs/index.html` from `main`. See the [release checklist](DEVELOPMENT_PLAN.md#publish-the-github-pages-showcase) for the live interaction checks.
