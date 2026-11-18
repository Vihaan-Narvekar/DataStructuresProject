# The Market That Broke a Tree

Build an ordinary binary search tree and an AVL tree from the same stock prices. Replay the keys in different orders, predict search costs, and repair an AVL imbalance with a rotation.

## Run locally

Open [`docs/index.html`](docs/index.html) in your browser. The bundled script is included, so the lesson can run directly from the file.

To preview over HTTP instead, run this from the project directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open [the local lesson](http://127.0.0.1:8000/). All prices and results are processed in the browser. A run can contain up to 64 unique prices.

## Try the lesson

1. Insert prices one at a time, or use **Generate prices** to set a starting price, increment, and count. After previewing your prices, choose **Replay this order** and press **Step** or **Play**.
2. Choose **Use a deepest BST key**. Record your predictions, then search the two trees and compare the paths.
3. Use **Load a sequence** to replay the same prices in descending or shuffled order. Open **Compare as the trees grow** to inspect the measured heights and search costs.
4. Open **Practice a rotation** after a run triggers an AVL imbalance. Drag a child onto its parent, or select a pivot and use the rotation buttons. Use **Undo move** and **Retry** to explore.

In the comparison panels, use the arrow buttons or Shift + arrow keys to move a selected node. **Fit** adjusts the zoom for deeper trees. **How it works** includes an option to reduce animations.

## Run tests

With Node.js installed, run:

```sh
npm test
```

The tests exercise exact-cent parsing, sequence replay, comparison counts, undo, all four AVL rotation cases, and the rotation practice model.

After editing a module in `docs/js/`, regenerate the browser bundle:

```sh
npm ci
npm run build
```

## GitHub Pages handoff

The static site entry point is `docs/index.html`. When the GitHub repository is ready, select **Deploy from a branch** in **Settings → Pages**, then choose `main` and `/docs`. See the [release checklist](DEVELOPMENT_PLAN.md#publish-the-github-pages-showcase) for the live interaction checks.
